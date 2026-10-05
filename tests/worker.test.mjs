import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerId, executeJob } from '../server/worker.mjs';
import { validateChildrenFactoryVideo } from '../server/factory-qa.mjs';

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


test('Children Factory QA passes a complete verified narrated episode', () => {
  const result = validateChildrenFactoryVideo({
    videoBytes: 1024,
    width: 1280,
    height: 720,
    durationSeconds: 15,
    sourceImageCount: 3,
    expectedImageCount: 3,
    hasVideoStream: true,
    hasAudioStream: true,
    narrationRequested: true,
    provider: 'higgsfield',
    mediaKey: 'jarvis/user/video-render/final.mp4',
  });
  assert.equal(result.passed, true);
  assert.ok(result.checks.includes('narration_audio_present'));
});

test('Children Factory QA blocks missing narration audio', () => {
  const result = validateChildrenFactoryVideo({
    videoBytes: 1024,
    width: 1280,
    height: 720,
    durationSeconds: 15,
    sourceImageCount: 3,
    expectedImageCount: 3,
    hasVideoStream: true,
    hasAudioStream: false,
    narrationRequested: true,
    provider: 'higgsfield',
    mediaKey: 'jarvis/user/video-render/final.mp4',
  });
  assert.equal(result.passed, false);
  assert.match(result.reason, /audio stream/);
});

test('Children Factory QA blocks non-16:9 video', () => {
  const result = validateChildrenFactoryVideo({
    videoBytes: 1024,
    width: 720,
    height: 1280,
    durationSeconds: 15,
    sourceImageCount: 3,
    expectedImageCount: 3,
    hasVideoStream: true,
    hasAudioStream: true,
    narrationRequested: false,
    provider: 'higgsfield',
    mediaKey: 'jarvis/user/video-render/final.mp4',
  });
  assert.equal(result.passed, false);
  assert.match(result.reason, /16:9/);
});
