import test from 'node:test';
import assert from 'node:assert/strict';
import {
  workloadClass,
  workloadPolicy,
  groupWorkloadBatch,
  nextWorkDelayMs,
} from '../server/workload-governor.mjs';

test('workload governor classifies heavy work conservatively', () => {
  assert.equal(workloadClass('video_pipeline'), 'heavy');
  assert.equal(workloadPolicy({ type: 'video_pipeline' }).maxConcurrency, 1);
  assert.equal(workloadPolicy({ type: 'video_pipeline' }).checkpointRequired, true);
});

test('light routine jobs can run together', () => {
  const jobs = [
    { type: 'memory_maintenance' },
    { type: 'health_check' },
    { type: 'analytics_refresh' },
    { type: 'trend_scan' },
    { type: 'notification' },
  ];
  const batch = groupWorkloadBatch(jobs, 4);
  assert.equal(batch.length, 4);
  assert.ok(batch.every(job => workloadClass(job) === 'light'));
});

test('heavy work is isolated from parallel batches', () => {
  const jobs = [
    { type: 'memory_maintenance' },
    { type: 'video_pipeline' },
    { type: 'health_check' },
  ];
  const batch = groupWorkloadBatch(jobs, 4);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].type, 'video_pipeline');
});

test('backoff grows safely but stays bounded', () => {
  assert.equal(nextWorkDelayMs({ queueEmpty: true }), 5000);
  assert.equal(nextWorkDelayMs({ failureCount: 3, baseMs: 1000 }), 8000);
  assert.equal(nextWorkDelayMs({ failureCount: 99, baseMs: 1000, maxMs: 10000 }), 10000);
});
