import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVideoJobIdempotencyKey } from '../server/store.mjs';

test('video job idempotency key is stable for equivalent payloads', () => {
  const a = buildVideoJobIdempotencyKey('project-1', {
    operation: 'render',
    image_keys: ['a', 'b'],
    mission_id: 'mission-1',
  });
  const b = buildVideoJobIdempotencyKey('project-1', {
    mission_id: 'mission-1',
    image_keys: ['a', 'b'],
    operation: 'render',
  });
  assert.equal(a, b);
  assert.match(a, /^video:project-1:render:payload:[a-f0-9]{64}$/);
});

test('video job idempotency key changes when the operation changes', () => {
  const planKey = buildVideoJobIdempotencyKey(
    'project-1',
    { operation: 'plan', request: { title: 'Kobi' } },
  );
  const renderKey = buildVideoJobIdempotencyKey(
    'project-1',
    { operation: 'render', request: { title: 'Kobi' } },
  );
  assert.notEqual(planKey, renderKey);
});

test('video job idempotency key honors an explicit client key', () => {
  const key = buildVideoJobIdempotencyKey(
    'project-1',
    { operation: 'render', image_keys: ['a'] },
    'request-123',
  );
  assert.equal(key, 'video:project-1:render:client:request-123');
});
