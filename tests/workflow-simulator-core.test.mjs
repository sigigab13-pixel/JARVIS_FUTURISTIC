import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateWorkflow, compareWorkflowPlans } from '../server/workflow-simulator-core.mjs';

const capabilities = [
  { id: 'chat', label: 'Conversation Core', available: true },
  { id: 'video', label: 'Video Lab', available: true },
  { id: 'youtube', label: 'YouTube', available: false },
];

test('dry run produces a human-readable plan and never executes side effects', () => {
  const result = simulateWorkflow({
    plan: {
      requestMode: 'execute',
      subtasks: ['Draft the video', 'Review the video', 'Publish the video'],
    },
    capabilities,
  });

  assert.equal(result.mode, 'dry_run');
  assert.equal(result.simulated, true);
  assert.equal(result.sideEffectsExecuted, false);
  assert.match(result.preview, /Draft the video → Review the video → Publish the video/);
});

test('side-effect workflows require explicit authorization or approval', () => {
  const result = simulateWorkflow({
    plan: {
      requestMode: 'execute',
      subtasks: [{ title: 'Publish to YouTube', capability: 'youtube', sideEffect: true }],
    },
    capabilities,
  });

  assert.equal(result.summary.approvalRequired, true);
  assert.equal(result.summary.approvalStatus, 'not_granted');
  assert.ok(result.summary.failurePoints.some(item => item.code === 'APPROVAL_REQUIRED'));
});

test('simulator surfaces unavailable capability without pretending it will work', () => {
  const result = simulateWorkflow({
    mission: {
      autonomy: 'execute_with_approval',
      approval: { status: 'approved' },
      steps: [{ title: 'Publish', capability: 'youtube', executorType: 'youtube', sideEffect: true }],
    },
    capabilities,
    supportedAdapters: ['youtube'],
  });

  assert.equal(result.summary.blocked, true);
  assert.ok(result.summary.failurePoints.some(item => item.code === 'CAPABILITY_UNAVAILABLE'));
  assert.equal(result.sideEffectsExecuted, false);
});

test('simulator predicts permission and dependency requirements', () => {
  const result = simulateWorkflow({
    mission: {
      autonomy: 'prepare',
      steps: [
        { id: 'a', title: 'Create draft', capability: 'chat', executorType: 'reasoning' },
        { id: 'b', title: 'Review draft', capability: 'chat', executorType: 'reasoning', permissions: ['read:draft'] },
      ],
    },
    capabilities,
    supportedAdapters: ['reasoning'],
  });

  assert.deepEqual(result.steps[0].permissions, ['use:chat']);
  assert.deepEqual(result.steps[1].permissions, ['read:draft']);
  assert.ok(result.steps[1].dependencies.includes('step-1'));
});

test('simulator reports unknown costs instead of inventing them', () => {
  const result = simulateWorkflow({
    mission: {
      autonomy: 'prepare',
      steps: [
        { title: 'A', capability: 'chat', executorType: 'reasoning', estimatedCost: 3 },
        { title: 'B', capability: 'chat', executorType: 'reasoning' },
      ],
    },
    capabilities,
    supportedAdapters: ['reasoning'],
  });

  assert.equal(result.summary.estimatedCost, 3);
  assert.equal(result.summary.costKnown, false);
});

test('unsupported adapters are identified before execution', () => {
  const result = simulateWorkflow({
    mission: {
      autonomy: 'prepare',
      steps: [{ title: 'Render', capability: 'video', executorType: 'higgsfield' }],
    },
    capabilities,
    supportedAdapters: ['reasoning'],
  });

  assert.ok(result.steps[0].failurePoints.some(item => item.code === 'UNSUPPORTED_ADAPTER'));
});

test('alternative plans are compared and safest effective route is selected', () => {
  const result = compareWorkflowPlans({
    plans: [
      { label: 'Risky', requestMode: 'execute', subtasks: [{ title: 'Publish', sideEffect: true }] },
      { label: 'Safe', requestMode: 'prepare', subtasks: ['Prepare', 'Verify'] },
    ],
    capabilities,
  });

  assert.equal(result.compared, 2);
  assert.equal(result.selectedIndex, 1);
  assert.equal(result.alternatives[0].label, 'Safe');
});

test('step and alternative limits are bounded', () => {
  const result = simulateWorkflow({
    plan: {
      requestMode: 'prepare',
      subtasks: Array.from({ length: 20 }, (_, i) => `Step ${i + 1}`),
    },
    capabilities,
  });
  assert.equal(result.steps.length, 8);

  const compare = compareWorkflowPlans({
    plans: Array.from({ length: 10 }, (_, i) => ({ label: `P${i + 1}`, requestMode: 'prepare', subtasks: ['A'] })),
    capabilities,
  });
  assert.equal(compare.compared, 4);
});
