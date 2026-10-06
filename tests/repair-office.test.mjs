import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRepairDecision,
  classifyRepairFailure,
  getRepairOfficePolicy,
} from '../server/repair-office.mjs';

test('Repair Office classifies only known failure categories', () => {
  assert.equal(classifyRepairFailure({ category: 'transient', retryable: true }), 'transient');
  assert.equal(classifyRepairFailure({ category: 'dependency' }), 'dependency');
  assert.equal(classifyRepairFailure({ category: 'not-a-real-category' }), 'unknown');
});

test('transient failures receive a bounded recovery attempt', () => {
  assert.deepEqual(
    buildRepairDecision({ category: 'transient', retryable: true, attempts: 1, maxAttempts: 3 }),
    {
      status: 'recoverable',
      action: 'bounded_retry',
      attempt: 2,
      maxAttempts: 3,
      terminal: false,
    },
  );
});

test('retry budget exhaustion becomes terminal instead of looping forever', () => {
  const decision = buildRepairDecision({
    category: 'transient',
    retryable: true,
    attempts: 3,
    maxAttempts: 3,
  });
  assert.equal(decision.status, 'escalate');
  assert.equal(decision.terminal, true);
  assert.equal(decision.action, 'bounded_retry');
});

test('authorization and unknown failures never self-repair', () => {
  assert.equal(buildRepairDecision({ category: 'authorization' }).terminal, true);
  assert.equal(buildRepairDecision({ category: 'unknown' }).action, 'stop_and_escalate');
});

test('Repair Office policy forbids autonomous production mutation', () => {
  const policy = getRepairOfficePolicy();
  assert.equal(policy.autonomousMutation, false);
  assert.equal(policy.maxRetryAttempts, 3);
  assert.ok(policy.parentLaws.includes(1));
  assert.ok(policy.parentLaws.includes(5));
  assert.ok(policy.parentLaws.includes(23));
});
