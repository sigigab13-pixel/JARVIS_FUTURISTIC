import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMissionAction } from '../server/mission-actions.mjs';
import { createMissionState } from '../server/mission-runtime.mjs';
import { buildMissionFailureState } from '../server/worker.mjs';

const missionId = '66666666-6666-4666-8666-666666666666';
const userId = '77777777-7777-4777-8777-777777777777';

function baseMission(status = 'draft') {
  return {
    ...createMissionState({
      missionId,
      userId,
      goal: 'Test lifecycle',
      steps: [{ id: 'step-1', executorType: 'routine_fanout', sideEffect: false }],
    }),
    status,
    currentStep: 0,
    approval: { required: false, status: 'not_required' },
  };
}

test('start prepares a durable queued execution state', () => {
  const result = prepareMissionAction(baseMission('draft'), 'start');
  assert.equal(result.next.status, 'queued');
  assert.equal(result.eventType, 'mission.queued');
});

test('approve records approval and resumes execution', () => {
  const mission = {
    ...baseMission('waiting_approval'),
    approval: { required: true, status: 'pending' },
  };
  const result = prepareMissionAction(mission, 'approve');
  assert.equal(result.next.status, 'running');
  assert.equal(result.next.approval.status, 'approved');
  assert.ok(result.next.approval.approvedAt);
});

test('resume re-queues a paused mission', () => {
  const result = prepareMissionAction(baseMission('paused'), 'resume');
  assert.equal(result.next.status, 'queued');
  assert.equal(result.eventType, 'mission.resumed');
});

test('retry re-queues a failed mission', () => {
  const result = prepareMissionAction(baseMission('failed'), 'retry');
  assert.equal(result.next.status, 'queued');
  assert.equal(result.eventType, 'mission.retried');
});

test('invalid lifecycle actions are rejected', () => {
  assert.throws(
    () => prepareMissionAction(baseMission('running'), 'resume'),
    /Only a paused mission can be resumed/
  );
});

test('mission failure is recorded only after the durable job reaches terminal failure', () => {
  const mission = baseMission('running');

  const failed = buildMissionFailureState(mission, {
    jobId: 'job-123',
    adapter: 'image_generation',
    attempts: 3,
    error: new Error('provider unavailable'),
  });

  assert.equal(failed.status, 'failed');
  assert.equal(failed.lastEvidence.verified, false);
  assert.equal(failed.lastEvidence.error.message, 'provider unavailable');
  assert.equal(failed.metadata.lastFailure.attempts, 3);
});
