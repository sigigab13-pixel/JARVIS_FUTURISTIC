import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerId, executeJob } from '../server/worker.mjs';

test('worker creates unique stable ids', () => {
  const a = createWorkerId();
  const b = createWorkerId();
  assert.match(a, /^jarvis-worker-/);
  assert.notEqual(a, b);
});

test('worker builds a dependency-aware video plan without spending provider credits', async () => {
  const result = await executeJob({
    type: 'video_pipeline',
    payload: { operation: 'plan', project_id: 'project-1' },
  });
  assert.equal(result.accepted, true);
  assert.equal(result.type, 'video_pipeline');
  assert.equal(result.projectId, 'project-1');
  assert.equal(result.mode, 'dependency_planned');
  assert.equal(result.safety.spending, 'no provider credits are consumed by planning');
  assert.deepEqual(result.executionPolicy.parallel, [
    ['character_bible', 'world_asset_bible'],
  ]);
  assert.equal(result.executionPolicy.maxConcurrentWorkers, 4);
  assert.equal(result.executionPolicy.hardConcurrencyCap, 8);
});

test('video plan keeps voice dependent on the story', async () => {
  const result = await executeJob({
    type: 'video_pipeline',
    payload: { operation: 'plan', project_id: 'project-2' },
  });
  const voice = result.stages.find(stage => stage.id === 'voice_audio');
  assert.deepEqual(voice.dependsOn, ['story_director']);
});

test('worker safely records unknown job types', async () => {
  const result = await executeJob({ type: 'future_capability', payload: {} });
  assert.equal(result.accepted, true);
  assert.equal(result.type, 'future_capability');
  assert.match(result.message, /unregistered job type/);
});
