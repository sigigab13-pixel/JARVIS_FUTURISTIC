import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMissionOutcome,
  buildRegressionSignal,
  detectEvaluationDegradation,
  proposeControlledImprovement,
  compareEvaluationRuns,
} from '../server/agent-evaluation-core.mjs';

function mission(overrides = {}) {
  return {
    status: 'succeeded',
    steps: [{ status: 'succeeded' }, { status: 'succeeded' }],
    lastEvidence: { verified: true, result: { published: true } },
    ...overrides,
  };
}

test('evaluates completed missions across outcome dimensions', () => {
  const result = evaluateMissionOutcome({
    mission: mission(),
    criteria: { minQuality: 0.8, minAccuracy: 0.9, maxCost: 5, maxLatencyMs: 3000 },
    observation: { quality: 0.92, accuracy: 0.96, cost: 3, latencyMs: 1400, verified: true },
  });
  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
});

test('failed mission evaluation identifies the exact failed dimensions', () => {
  const result = evaluateMissionOutcome({
    mission: mission({ steps: [{ status: 'succeeded' }, { status: 'failed' }] }),
    criteria: { minQuality: 0.9, maxCost: 2 },
    observation: { quality: 0.7, cost: 4 },
  });
  assert.equal(result.passed, false);
  assert.ok(result.failures.some(item => item.name === 'steps'));
  assert.ok(result.failures.some(item => item.name === 'evidence'));
  assert.ok(result.failures.some(item => item.name === 'quality'));
  assert.ok(result.failures.some(item => item.name === 'cost'));
});

test('user correction or mission failure creates a regression candidate, not an automatic rewrite', () => {
  const signal = buildRegressionSignal({
    evaluation: { score: 40, failures: [{ name: 'accuracy' }] },
    userCorrection: 'The selected title was wrong.',
    context: { capability: 'children', version: 'v1' },
  });
  assert.equal(signal.type, 'regression_candidate');
  assert.equal(signal.requiresTestBeforeFix, true);
  assert.equal(signal.productionWorkflowMutation, 'forbidden');
});

test('degradation detector catches meaningful quality and cost regression', () => {
  const result = detectEvaluationDegradation({
    baseline: { quality: 0.9, accuracy: 0.95, cost: 4 },
    current: { quality: 0.78, accuracy: 0.94, cost: 5.2 },
  });
  assert.equal(result.degraded, true);
  assert.ok(result.regressions.some(item => item.metric === 'quality'));
  assert.ok(result.regressions.some(item => item.metric === 'cost'));
});

test('controlled improvement proposal requires evaluation before activation', () => {
  const proposal = proposeControlledImprovement({
    regression: { regressions: [{ metric: 'quality' }] },
    candidate: { version: 'v2', changes: ['adjust prompt'], expectedImprovement: 'Higher accuracy' },
  });
  assert.equal(proposal.safety.requiresEvaluation, true);
  assert.equal(proposal.safety.silentCriticalWorkflowRewrite, false);
});

test('candidate comparison does not claim an improvement without evidence', () => {
  const comparison = compareEvaluationRuns({
    baseline: { score: 90, quality: 0.9, cost: 4, latencyMs: 1000 },
    candidate: { score: 88, quality: 0.88, cost: 4.2, latencyMs: 1100 },
  });
  assert.equal(comparison.preferred, 'baseline');
});
