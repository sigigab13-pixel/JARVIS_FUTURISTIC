import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTransition,
  createMissionState,
  transitionMission,
  advanceMissionStep,
  normalizeMissionForStorage,
} from '../server/mission-runtime.mjs';

test('mission state starts in draft with ordered steps', () => {
  const state = createMissionState({
    missionId: 'm1',
    goal: 'Create and prepare a video',
    steps: [
      { id: 'research', title: 'Research topic', capability: 'web_intelligence' },
      { id: 'video', title: 'Create video', capability: 'video' },
    ],
  });
  assert.equal(state.status, 'draft');
  assert.equal(state.currentStep, 0);
  assert.equal(state.steps[1].capability, 'video');
});

test('mission transitions enforce the state machine', () => {
  assertTransition('draft', 'queued');
  assert.throws(() => assertTransition('draft', 'succeeded'), /Invalid mission transition/);
  const queued = transitionMission(createMissionState({ missionId: 'm2' }), 'queued');
  const running = transitionMission(queued, 'running');
  assert.equal(running.status, 'running');
});

test('mission advances by verified step completion', () => {
  const state = createMissionState({
    missionId: 'm3',
    steps: [{ title: 'A' }, { title: 'B' }],
  });
  const running = transitionMission(transitionMission(state, 'queued'), 'running');
  const next = advanceMissionStep(running);
  assert.equal(next.status, 'running');
  assert.equal(next.currentStep, 1);
  const done = advanceMissionStep(next);
  assert.equal(done.status, 'succeeded');
});

test('storage normalization excludes runtime-only nesting', () => {
  const state = createMissionState({ missionId: 'm4', goal: 'x' });
  const normalized = normalizeMissionForStorage(state);
  assert.equal(normalized.mission_id, 'm4');
  assert.ok(!('userId' in normalized));
});
