import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkerId,
  executeJob,
  executeChildrenFactoryScene,
  getVideoRenderGeometry,
  buildVideoFilter,
  normalizeClaimedJobResult,
  normalizeChildrenFactorySceneInput,
  areChildrenFactoryScenesComplete,
  isVerifiedChildrenFactoryImage,
  evaluateRenderedVideoProbe,
  isVerifiedChildrenFactoryVideo,
} from '../server/worker.mjs';

test('worker claim normalization treats empty and all-null RPC results as no job', () => {
  const emptyComposite = {
    id: null, user_id: null, type: null, payload: null, status: null,
  };
  assert.equal(normalizeClaimedJobResult(null, 'worker_claim_next_job'), null);
  assert.equal(normalizeClaimedJobResult([], 'worker_claim_next_job'), null);
  assert.equal(normalizeClaimedJobResult([null], 'worker_claim_next_job'), null);
  assert.equal(normalizeClaimedJobResult(emptyComposite, 'worker_claim_next_job'), null);
  assert.equal(normalizeClaimedJobResult([emptyComposite], 'worker_claim_next_job'), null);
  assert.equal(normalizeClaimedJobResult(
    { worker_claim_next_job: null }, 'worker_claim_next_job',
  ), null);
  assert.equal(normalizeClaimedJobResult(
    { worker_claim_job: emptyComposite }, 'worker_claim_job',
  ), null);
});

test('worker claim normalization preserves a valid job row', () => {
  const job = {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    type: 'mission_step',
    payload: { mission_id: '33333333-3333-4333-8333-333333333333' },
    status: 'running',
  };
  assert.equal(normalizeClaimedJobResult(job, 'worker_claim_next_job'), job);
  assert.equal(normalizeClaimedJobResult([job], 'worker_claim_job'), job);
  assert.equal(normalizeClaimedJobResult(
    { worker_claim_job: job }, 'worker_claim_job',
  ), job);
});

test('Children Factory storage image verification requires image content and matching SHA-256 digests', () => {
  const digest = 'a'.repeat(64);
  assert.equal(isVerifiedChildrenFactoryImage({
    contentType: 'image/png',
    actualSha256: digest,
    expectedSha256: digest,
  }), true);
  assert.equal(isVerifiedChildrenFactoryImage({
    contentType: 'text/plain',
    actualSha256: digest,
    expectedSha256: digest,
  }), false);
  assert.equal(isVerifiedChildrenFactoryImage({
    contentType: 'image/png',
    actualSha256: digest,
    expectedSha256: 'b'.repeat(64),
  }), false);
  assert.equal(isVerifiedChildrenFactoryImage({
    contentType: 'image/png',
    actualSha256: digest,
    expectedSha256: 'not-a-digest',
  }), false);
});

test('Children Factory scene input requires a complete normalized character bible', () => {
  assert.throws(
    () => normalizeChildrenFactorySceneInput({
      story: 'A story',
      character: { name: 'Milo', species: 'fox', color: 'orange', clothes: '   ' },
      scene: 1,
      totalScenes: 3,
    }),
    /requires a story and complete character bible/i,
  );
  const normalized = normalizeChildrenFactorySceneInput({
    story: '  A story  ',
    character: { name: ' Milo ', species: ' fox ', color: ' orange ', clothes: ' blue scarf ' },
    scene: 2,
    totalScenes: 3,
  });
  assert.equal(normalized.story, 'A story');
  assert.equal(normalized.character.name, 'Milo');
  assert.equal(normalized.character.clothes, 'blue scarf');
  assert.equal(normalized.scene, 2);
});

test('Children Factory scene assets are complete only when every numbered scene is verified', () => {
  const asset = scene => ({
    scene,
    sha256: String(scene).padStart(64, 'a'),
    media: { key: 'jarvis/user/scene-' + scene + '.png', stored: true },
    verified: true,
  });
  assert.equal(areChildrenFactoryScenesComplete([asset(1), asset(2), asset(3)], 3), true);
  assert.equal(areChildrenFactoryScenesComplete([asset(1), asset(3)], 3), false);
  assert.equal(areChildrenFactoryScenesComplete([asset(1), { ...asset(2), verified: false }, asset(3)], 3), false);
  assert.equal(areChildrenFactoryScenesComplete([asset(1), asset(2), asset(2), asset(3)], 3), false);
  assert.equal(areChildrenFactoryScenesComplete([asset(1), asset(2), asset(2)], 3), false);
  assert.equal(areChildrenFactoryScenesComplete([
    asset(1), asset(2), asset(3), { ...asset(3), scene: 4 },
  ], 3), false);
  assert.equal(areChildrenFactoryScenesComplete([
    asset(1), asset(2), { ...asset(3), sha256: 'not-a-sha256-digest' },
  ], 3), false);
});

test('Children Factory scene worker rejects missing durable scene identity before provider work', async () => {
  await assert.rejects(
    executeChildrenFactoryScene({
      type: 'video_pipeline',
      user_id: '11111111-1111-4111-8111-111111111111',
      payload: {
        operation: 'children_factory_scene',
        project_id: '22222222-2222-4222-8222-222222222222',
        mission_id: '33333333-3333-4333-8333-333333333333',
        scene: 0,
        total_scenes: 3,
      },
    }),
    error => /missing a valid mission, project, user, or scene identity/i.test(error?.message || '')
  );
});

test('Children Factory scene worker rejects foreign project mission identities', async () => {
  await assert.rejects(
    executeChildrenFactoryScene({
      type: 'video_pipeline',
      user_id: '11111111-1111-4111-8111-111111111111',
      payload: {
        operation: 'children_factory_scene',
        project_id: '22222222-2222-4222-8222-222222222222',
        mission_id: '33333333-3333-4333-8333-333333333333',
        scene: 1,
        total_scenes: 3,
      },
    }),
    error => /mission was not found or does not belong to this video project/i.test(error?.message || '')
  );
});
import { buildChildrenFactoryPipeline, canPublishChildrenFactoryMission, normalizeChildrenFactoryDraft } from '../server/server.mjs';

test('worker creates unique stable ids', () => {
  const a = createWorkerId();
  const b = createWorkerId();
  assert.match(a, /^jarvis-worker-/);
  assert.notEqual(a, b);
});

test('worker rejects malformed video jobs instead of claiming success', async () => {
  await assert.rejects(
    executeJob({
      type: 'video_pipeline',
      payload: { operation: 'plan', project_id: 'project-1' },
    }),
    error => error?.message === 'Video render requires a JARVIS user and stored image assets.'
  );
});

test('worker rejects unknown job types instead of claiming success', async () => {
  await assert.rejects(
    executeJob({ type: 'future_capability', payload: {} }),
    error => error?.code === 'JOB_ADAPTER_UNAVAILABLE'
  );
});


test('Children Factory uses vertical geometry for 9:16 renders', () => {
  assert.deepEqual(getVideoRenderGeometry('9:16'), {
    width: 1080,
    height: 1920,
    label: '9:16',
  });
});

test('legacy video projects keep landscape geometry by default', () => {
  assert.deepEqual(getVideoRenderGeometry('16:9'), {
    width: 1280,
    height: 720,
    label: '16:9',
  });
});


test('Children Factory motion filter fills the vertical frame and uses zoompan', () => {
  const geometry = getVideoRenderGeometry('9:16');
  const filter = buildVideoFilter(0, geometry);
  assert.match(filter, /scale=1080:1920/);
  assert.match(filter, /crop=1080:1920/);
  assert.match(filter, /zoompan=/);
  assert.match(filter, /s=1080x1920/);
});


test('Children Factory pipeline starts render-pending and publish-blocked', () => {
  const pipeline = buildChildrenFactoryPipeline();
  assert.deepEqual(
    pipeline.map(stage => [stage.id, stage.status]),
    [
      ['story', 'completed'],
      ['character_bible', 'completed'],
      ['scene_assets', 'completed'],
      ['render', 'pending'],
      ['verified_video', 'blocked'],
      ['approval', 'pending'],
      ['publish', 'blocked'],
    ],
  );
});

test('Children Factory pipeline marks queued render without unlocking publish', () => {
  const pipeline = buildChildrenFactoryPipeline({ renderQueued: true });
  assert.equal(pipeline.find(stage => stage.id === 'render')?.status, 'queued');
  assert.equal(pipeline.find(stage => stage.id === 'verified_video')?.status, 'blocked');
  assert.equal(pipeline.find(stage => stage.id === 'publish')?.status, 'blocked');
});


test('Children Factory exposes scene asset progress and failure without unlocking later stages', () => {
  const running = buildChildrenFactoryPipeline({
    sceneAssetsStatus: 'running',
    approvalStatus: 'blocked',
  });
  assert.equal(running.find(stage => stage.id === 'scene_assets')?.status, 'running');
  assert.equal(running.find(stage => stage.id === 'render')?.status, 'pending');
  assert.equal(running.find(stage => stage.id === 'publish')?.status, 'blocked');

  const failed = buildChildrenFactoryPipeline({
    sceneAssetsStatus: 'failed',
    approvalStatus: 'blocked',
  });
  assert.equal(failed.find(stage => stage.id === 'scene_assets')?.status, 'failed');
  assert.equal(failed.find(stage => stage.id === 'render')?.status, 'pending');
  assert.equal(failed.find(stage => stage.id === 'verified_video')?.status, 'blocked');
  assert.equal(failed.find(stage => stage.id === 'publish')?.status, 'blocked');
});


test('Children Factory cannot publish before a verified video', () => {
  const base = {
    approval: { status: 'approved' },
    metadata: {
      factory: 'children-v1',
      pipeline: { render: 'completed', verified_video: 'blocked' },
      verifiedVideo: null,
    },
  };
  assert.equal(canPublishChildrenFactoryMission(base), false);
});

function verifiedChildrenFactoryMission(approvalStatus = 'approved') {
  const sha256 = 'a'.repeat(64);
  const video = {
    verified: true,
    verificationMethod: 'ffprobe+storage-readback',
    mediaKey: 'jarvis/user/video.mp4',
    sha256,
    durationSeconds: 12,
    width: 1080,
    height: 1920,
  };
  return {
    approval: { status: approvalStatus },
    metadata: {
      factory: 'children-v1',
      pipeline: { render: 'completed', verified_video: 'completed' },
      renderedVideo: { mediaKey: video.mediaKey, sha256 },
      verifiedVideo: video,
    },
  };
}

test('Children Factory cannot publish before approval even after technical verification', () => {
  const mission = verifiedChildrenFactoryMission('pending');
  assert.equal(canPublishChildrenFactoryMission(mission), false);
});

test('Children Factory cannot publish from a media key alone without technical verification evidence', () => {
  const mission = verifiedChildrenFactoryMission('approved');
  mission.metadata.verifiedVideo = { mediaKey: 'jarvis/user/video.mp4' };
  assert.equal(canPublishChildrenFactoryMission(mission), false);
});

test('Children Factory cannot publish when rendered and verified hashes do not match', () => {
  const mission = verifiedChildrenFactoryMission('approved');
  mission.metadata.renderedVideo.sha256 = 'b'.repeat(64);
  assert.equal(canPublishChildrenFactoryMission(mission), false);
});

test('Children Factory can publish only after technical video verification and approval', () => {
  assert.equal(canPublishChildrenFactoryMission(verifiedChildrenFactoryMission('approved')), true);
});


test('Children Factory rejects whitespace-only title and required character fields after normalization', () => {
  const story = Array.from({ length: 130 }, () => 'story').join(' ');
  const base = {
    title: 'A Little Adventure',
    story,
    character: { name: 'Milo', species: 'fox', color: 'orange', clothes: 'blue scarf', description: 'Curious and kind' },
  };

  assert.throws(
    () => normalizeChildrenFactoryDraft({ ...base, title: '   ' }),
    error => error?.statusCode === 502 && /incomplete story or character bible/i.test(error.message),
  );
  for (const field of ['name', 'species', 'color', 'clothes']) {
    assert.throws(
      () => normalizeChildrenFactoryDraft({
        ...base,
        character: { ...base.character, [field]: '   ' },
      }),
      error => error?.statusCode === 502 && /incomplete story or character bible/i.test(error.message),
    );
  }
});

test('Children Factory returns trimmed title, story and character fields', () => {
  const story = Array.from({ length: 130 }, () => 'story').join(' ');
  const normalized = normalizeChildrenFactoryDraft({
    title: '  A Little Adventure  ',
    story: `  ${story}  `,
    character: {
      name: ' Milo ',
      species: ' fox ',
      color: ' orange ',
      clothes: ' blue scarf ',
      description: ' curious and kind ',
    },
  });

  assert.equal(normalized.title, 'A Little Adventure');
  assert.equal(normalized.story, story);
  assert.equal(normalized.character.name, 'Milo');
  assert.equal(normalized.character.species, 'fox');
  assert.equal(normalized.character.color, 'orange');
  assert.equal(normalized.character.clothes, 'blue scarf');
  assert.equal(normalized.character.description, 'curious and kind');
});

test('Children Factory rejects stories outside the 120–300 word range and malformed characters', () => {
  const character = { name: 'Milo', species: 'fox', color: 'orange', clothes: 'blue scarf' };
  const base = { title: 'A Little Adventure', story: Array.from({ length: 130 }, () => 'story').join(' '), character };
  assert.throws(
    () => normalizeChildrenFactoryDraft({ ...base, story: Array.from({ length: 119 }, () => 'story').join(' ') }),
    error => error?.statusCode === 502,
  );
  assert.throws(
    () => normalizeChildrenFactoryDraft({ ...base, story: Array.from({ length: 301 }, () => 'story').join(' ') }),
    error => error?.statusCode === 502,
  );
  assert.throws(
    () => normalizeChildrenFactoryDraft({ ...base, character: [] }),
    error => error?.statusCode === 502,
  );
});

const validVideoProbe = {
  format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '12.000' },
  streams: [{
    codec_type: 'video',
    codec_name: 'h264',
    pix_fmt: 'yuv420p',
    width: 1080,
    height: 1920,
  }],
};

test('rendered-video probe rejects missing streams, wrong codec, dimensions, or invalid duration', () => {
  assert.equal(evaluateRenderedVideoProbe({
    probe: validVideoProbe,
    expectedWidth: 1080,
    expectedHeight: 1920,
  }).ready, true);

  const missingVideo = evaluateRenderedVideoProbe({
    probe: { format: validVideoProbe.format, streams: [] },
    expectedWidth: 1080,
    expectedHeight: 1920,
  });
  assert.equal(missingVideo.ready, false);
  assert.ok(missingVideo.findings.some(item => item.code === 'VIDEO_STREAM_COUNT_INVALID'));

  const wrongCodec = evaluateRenderedVideoProbe({
    probe: { ...validVideoProbe, streams: [{ ...validVideoProbe.streams[0], codec_name: 'mpeg4' }] },
    expectedWidth: 1080,
    expectedHeight: 1920,
  });
  assert.ok(wrongCodec.findings.some(item => item.code === 'VIDEO_CODEC_INVALID'));

  const wrongDimensions = evaluateRenderedVideoProbe({
    probe: validVideoProbe,
    expectedWidth: 1280,
    expectedHeight: 720,
  });
  assert.ok(wrongDimensions.findings.some(item => item.code === 'VIDEO_DIMENSIONS_INVALID'));

  const invalidDuration = evaluateRenderedVideoProbe({
    probe: { ...validVideoProbe, format: { ...validVideoProbe.format, duration: 'NaN' } },
    expectedWidth: 1080,
    expectedHeight: 1920,
  });
  assert.ok(invalidDuration.findings.some(item => item.code === 'VIDEO_DURATION_INVALID'));
});

test('verified rendered video requires MP4 type, a matching SHA-256 digest, and passing probe metadata', () => {
  const digest = 'a'.repeat(64);
  const base = {
    contentType: 'video/mp4',
    actualSha256: digest,
    expectedSha256: digest,
    probe: validVideoProbe,
    expectedWidth: 1080,
    expectedHeight: 1920,
  };
  assert.equal(isVerifiedChildrenFactoryVideo(base), true);
  assert.equal(isVerifiedChildrenFactoryVideo({ ...base, contentType: 'text/plain' }), false);
  assert.equal(isVerifiedChildrenFactoryVideo({ ...base, actualSha256: 'b'.repeat(64) }), false);
  assert.equal(isVerifiedChildrenFactoryVideo({ ...base, expectedWidth: 1280 }), false);
});
