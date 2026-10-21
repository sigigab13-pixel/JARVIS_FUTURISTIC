import test from 'node:test';
import assert from 'node:assert/strict';
import { persistConversationSafely } from '../server/chat-persistence.mjs';

test('reports persistence success when conversation history is saved', async () => {
  const calls = [];
  const result = await persistConversationSafely({
    userId: 'user-123',
    messages: [{ role: 'user', content: 'Hello' }],
    appendMessages: async (userId, messages) => calls.push({ userId, messages }),
    logger: { error() { assert.fail('logger should not be called'); } },
  });

  assert.equal(result.persistent, true);
  assert.equal(result.warning, null);
  assert.deepEqual(calls, [{
    userId: 'user-123',
    messages: [{ role: 'user', content: 'Hello' }],
  }]);
});

test('does not turn a generated answer into a failed request when history saving fails', async () => {
  const logged = [];
  const result = await persistConversationSafely({
    userId: 'user-123',
    messages: [{ role: 'assistant', content: 'A valid answer' }],
    appendMessages: async () => { throw new Error('database unavailable'); },
    logger: { error: (...args) => logged.push(args) },
  });

  assert.equal(result.persistent, false);
  assert.match(result.warning, /answer was generated/i);
  assert.equal(logged.length, 1);
  assert.match(String(logged[0][1]), /database unavailable/);
});

test('does not attempt persistence for guest conversations', async () => {
  let called = false;
  const result = await persistConversationSafely({
    userId: null,
    messages: [],
    appendMessages: async () => { called = true; },
  });

  assert.equal(called, false);
  assert.deepEqual(result, { persistent: false, warning: null });
});
