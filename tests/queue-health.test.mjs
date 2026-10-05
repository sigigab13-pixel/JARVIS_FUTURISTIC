import test from 'node:test';
import assert from 'node:assert/strict';

import { getRedisHealthState } from '../server/queue.mjs';

test('Redis health state exposes bounded circuit settings without credentials', () => {
  const state = getRedisHealthState();

  assert.equal(typeof state.configured, 'boolean');
  assert.equal(typeof state.circuitOpen, 'boolean');
  assert.equal(state.timeoutMs >= 250 && state.timeoutMs <= 2000, true);
  assert.equal(state.retryAfterMs >= 0, true);

  const serialized = JSON.stringify(state);
  assert.doesNotMatch(serialized, /UPSTASH_REDIS_REST_TOKEN/i);
});
