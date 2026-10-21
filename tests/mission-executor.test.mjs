import test from 'node:test';
import assert from 'node:assert/strict';
import { getMissionAdapters, preflightMission, verifyMissionStepResult } from '../server/mission-executor.mjs';

const userId = '44444444-4444-4444-8444-444444444444';
const missionId = '55555555-5555-4555-8555-555555555555';

function mission(steps, overrides = {}) {
  return {
    id: missionId,
    userId,
    goal: 'Test mission',
    autonomy: 'advise',
    status: 'draft',
    currentStep: 0,
    steps,
    approval: { required: false, status: 'not_required' },
    ...overrides,
  };
}

test('mission executor advertises only real adapters', () => {
  assert.deepEqual(getMissionAdapters(), ['routine_fanout', 'image_generation']);
});

test('mission preflight accepts supported non-side-effect work', () => {
  const result = preflightMission(mission([
    { id: 'step-1', executorType: 'routine_fanout', sideEffect: false },
  ]));
  assert.equal(result.ok, true);
});

test('mission preflight blocks unsupported adapters', () => {
  const result = preflightMission(mission([
    { id: 'step-1', executorType: 'video_pipeline', sideEffect: false },
  ]));
  assert.equal(result.ok, false);
  assert.equal(result.unsupported[0].adapter, 'video_pipeline');
});

test('mission preflight accepts image generation with explicit approval', () => {
  const result = preflightMission(mission([
    { id: 'step-image', executorType: 'image_generation', sideEffect: true, prompt: 'A friendly illustrated lion for a children\'s rhyme.' },
  ], {
    autonomy: 'execute_with_approval',
    approval: { required: true, status: 'approved' },
  }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.adapters, ['image_generation']);
});

test('mission preflight blocks image generation without approval', () => {
  const result = preflightMission(mission([
    { id: 'step-image', executorType: 'image_generation', sideEffect: true, prompt: 'A friendly illustrated lion.' },
  ]));
  assert.equal(result.ok, false);
  assert.match(result.unsafeWithoutApproval[0].reason, /advise mode/);
});

test('mission preflight blocks side effects in advise mode', () => {
  const result = preflightMission(mission([
    { id: 'step-1', executorType: 'routine_fanout', sideEffect: true },
  ]));
  assert.equal(result.ok, false);
  assert.match(result.unsafeWithoutApproval[0].reason, /advise mode/);
});

test('mission preflight requires approval for side effects', () => {
  const result = preflightMission(mission([
    { id: 'step-1', executorType: 'routine_fanout', sideEffect: true },
  ], {
    autonomy: 'execute_with_approval',
  }));
  assert.equal(result.ok, false);
  assert.match(result.unsafeWithoutApproval[0].reason, /approval required/);
});

test('mission preflight blocks execute-within-policy side effects without explicit policy authorization', () => {
  const result = preflightMission(mission([
    { id: 'step-1', executorType: 'routine_fanout', sideEffect: true },
  ], {
    autonomy: 'execute_within_policy',
  }));
  assert.equal(result.ok, false);
  assert.equal(result.parentGate.violations[0].code, 'POLICY_AUTHORIZATION_REQUIRED');
});

test('mission step verification rejects adapter success without durable proof', () => {
  const result = verifyMissionStepResult('image_generation', {
    completed: true,
    provider: 'test',
  });
  assert.equal(result.verified, false);
  assert.equal(result.status, 'not_verified');
});

test('mission step verification confirms durable image evidence', () => {
  const result = verifyMissionStepResult('image_generation', {
    completed: true,
    provider: 'test',
    operation: 'image_generation',
    mediaKey: 'jarvis/user/mission-image.png',
    sha256: 'abc123',
  });
  assert.equal(result.verified, true);
  assert.equal(result.status, 'confirmed');
});
