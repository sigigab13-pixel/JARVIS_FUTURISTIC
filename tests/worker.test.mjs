import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerId, executeJob, getVideoRenderGeometry, buildVideoFilter } from '../server/worker.mjs';
import { buildChildrenFactoryPipeline } from '../server/server.mjs';

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
      ['approval', 'pending'],
      ['publish', 'blocked'],
    ],
  );
});

test('Children Factory pipeline marks queued render without unlocking publish', () => {
  const pipeline = buildChildrenFactoryPipeline({ renderQueued: true });
  assert.equal(pipeline.find(stage => stage.id === 'render')?.status, 'queued');
  assert.equal(pipeline.find(stage => stage.id === 'publish')?.status, 'blocked');
});
