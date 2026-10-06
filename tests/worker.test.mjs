import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkerId,
  executeJob,
  executeChildrenFactoryScene,
  getVideoRenderGeometry,
  buildVideoFilter,
} from '../server/worker.mjs';

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
import { buildChildrenFactoryPipeline, canPublishChildrenFactoryMission } from '../server/server.mjs';
import { buildChildrenFactoryDemoDraft, buildChildrenFactoryDemoFrame } from '../server/server.mjs';

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

test('Children Factory cannot publish before approval', () => {
  const base = {
    approval: { status: 'pending' },
    metadata: {
      factory: 'children-v1',
      pipeline: { render: 'completed', verified_video: 'completed' },
      verifiedVideo: { mediaKey: 'jarvis/user/video.mp4' },
    },
  };
  assert.equal(canPublishChildrenFactoryMission(base), false);
});

test('Children Factory can publish only after verified video and approval', () => {
  const mission = {
    approval: { status: 'approved' },
    metadata: {
      factory: 'children-v1',
      pipeline: { render: 'completed', verified_video: 'completed' },
      verifiedVideo: { mediaKey: 'jarvis/user/video.mp4' },
    },
  };
  assert.equal(canPublishChildrenFactoryMission(mission), true);
});


test('Children Factory zero-credit demo draft is deterministic and age-bounded', () => {
  const draft = buildChildrenFactoryDemoDraft('sharing with friends', 6);
  assert.equal(draft.character.name, 'Kobi');
  assert.equal(draft.age, 6);
  assert.match(draft.story, /sharing with friends/);
  assert.equal(typeof draft.title, 'string');
});

test('Children Factory zero-credit demo frames are valid PPM images', () => {
  const frame = buildChildrenFactoryDemoFrame(2);
  assert.match(frame.subarray(0, 80).toString('ascii'), /^P6\n\d+ \d+\n255\n/);
  assert.ok(frame.length > 100000);
});
