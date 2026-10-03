import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerId, executeJob } from '../server/worker.mjs';

test('worker creates unique stable ids', () => {
  const a = createWorkerId();
  const b = createWorkerId();
  assert.match(a, /^jarvis-worker-/);
  assert.notEqual(a, b);
});

test('worker rejects video jobs until a verified adapter exists', async () => {
  await assert.rejects(
    executeJob({
      type: 'video_pipeline',
      payload: { operation: 'plan', project_id: 'project-1' },
    }),
    error => error?.code === 'JOB_ADAPTER_UNAVAILABLE'
  );
});

test('worker rejects unknown job types instead of claiming success', async () => {
  await assert.rejects(
    executeJob({ type: 'future_capability', payload: {} }),
    error => error?.code === 'JOB_ADAPTER_UNAVAILABLE'
  );
});
