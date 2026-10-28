import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldApplyCloudHistory } from '../src/chat-history-guard.mjs';

test('applies saved cloud history when no chat interaction happened during the request', () => {
  assert.equal(shouldApplyCloudHistory(4, 4, [{ role: 'user', content: 'Earlier question' }]), true);
});

test('ignores delayed cloud history after the user starts a new chat interaction', () => {
  const requestInteractionVersion = 4;
  const currentInteractionVersion = 5;
  const delayedCloudHistory = [{ role: 'user', content: 'An unrelated older question' }];

  assert.equal(shouldApplyCloudHistory(requestInteractionVersion, currentInteractionVersion, delayedCloudHistory), false);
});

test('does not replace messages with an empty or invalid cloud history payload', () => {
  assert.equal(shouldApplyCloudHistory(2, 2, []), false);
  assert.equal(shouldApplyCloudHistory(2, 2, null), false);
});
