import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectMissionAgainstParentLaws,
  PARENT_LAW_MISSION_LIMITS,
} from '../server/parent-laws-core.mjs';

const baseMission = {
  id: '55555555-5555-4555-8555-555555555555',
  userId: '44444444-4444-4444-8444-444444444444',
  autonomy: 'advise',
  steps: [
    { id: 'step-1', executorType: 'routine_fanout', sideEffect: false },
  ],
};

test('Parent Law mission guard accepts bounded, identified work', () => {
  const result = inspectMissionAgainstParentLaws(baseMission);
  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
});

test('Parent Law mission guard rejects unapproved policy autonomy for side effects', () => {
  const result = inspectMissionAgainstParentLaws({
    ...baseMission,
    autonomy: 'execute_within_policy',
    steps: [{ ...baseMission.steps[0], sideEffect: true }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.violations.some(item => item.code === 'POLICY_AUTHORIZATION_REQUIRED'), true);
});

test('Parent Law mission guard accepts explicitly approved side-effect policy', () => {
  const result = inspectMissionAgainstParentLaws({
    ...baseMission,
    autonomy: 'execute_within_policy',
    metadata: {
      autonomyPolicy: {
        status: 'approved',
        allowSideEffects: true,
      },
    },
    steps: [{ ...baseMission.steps[0], sideEffect: true }],
  });
  assert.equal(result.ok, true);
});

test('Parent Law mission guard rejects retry budgets above the hard ceiling', () => {
  const result = inspectMissionAgainstParentLaws({
    ...baseMission,
    steps: [{ ...baseMission.steps[0], maxAttempts: PARENT_LAW_MISSION_LIMITS.maxStepAttempts + 1 }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.violations[0].code, 'RETRY_BUDGET_TOO_LARGE');
});

test('Parent Law mission guard requires stable identity for side effects', () => {
  const result = inspectMissionAgainstParentLaws({
    ...baseMission,
    steps: [{ ...baseMission.steps[0], id: '', sideEffect: true }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.violations.some(item => item.code === 'SIDE_EFFECT_IDENTITY_REQUIRED'), true);
});