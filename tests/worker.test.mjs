import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerId, executeJob, getVideoRenderGeometry } from '../server/worker.mjs';

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
