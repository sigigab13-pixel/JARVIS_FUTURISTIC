const MAX_NOTES = 8;
const MAX_REGRESSION_CASES = 6;

function clean(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function list(value, max = MAX_NOTES) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => clean(item, 300)).filter(Boolean))].slice(0, max);
}

function metric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function evaluateMissionOutcome({ mission = {}, criteria = {}, observation = {} } = {}) {
  const steps = Array.isArray(mission?.steps) ? mission.steps : [];
  const succeededSteps = steps.filter(step => String(step?.status || '') === 'succeeded').length;
  const failedSteps = steps.filter(step => String(step?.status || '') === 'failed').length;
  const status = String(mission?.status || '');
  const requiredStatus = String(criteria?.requiredStatus || 'succeeded');

  const quality = metric(observation?.quality ?? mission?.metadata?.evaluation?.quality);
  const accuracy = metric(observation?.accuracy ?? mission?.metadata?.evaluation?.accuracy);
  const cost = metric(observation?.cost ?? mission?.metadata?.evaluation?.cost);
  const latencyMs = metric(observation?.latencyMs ?? mission?.metadata?.evaluation?.latencyMs);
  const outcome = observation?.outcome ?? mission?.lastEvidence?.result ?? null;

  const checks = {
    missionStatus: {
      pass: status === requiredStatus,
      actual: status,
      expected: requiredStatus,
    },
    steps: {
      pass: failedSteps === 0 && succeededSteps === steps.length && steps.length > 0,
      succeeded: succeededSteps,
      failed: failedSteps,
      total: steps.length,
    },
    evidence: {
      pass: Boolean(mission?.lastEvidence?.verified === true || observation?.verified === true),
      verified: Boolean(mission?.lastEvidence?.verified === true || observation?.verified === true),
    },
    quality: {
      pass: criteria?.minQuality == null || (quality !== null && quality >= Number(criteria.minQuality)),
      actual: quality,
      minimum: criteria?.minQuality == null ? null : Number(criteria.minQuality),
    },
    accuracy: {
      pass: criteria?.minAccuracy == null || (accuracy !== null && accuracy >= Number(criteria.minAccuracy)),
      actual: accuracy,
      minimum: criteria?.minAccuracy == null ? null : Number(criteria.minAccuracy),
    },
    cost: {
      pass: criteria?.maxCost == null || (cost !== null && cost <= Number(criteria.maxCost)),
      actual: cost,
      maximum: criteria?.maxCost == null ? null : Number(criteria.maxCost),
    },
    latency: {
      pass: criteria?.maxLatencyMs == null || (latencyMs !== null && latencyMs <= Number(criteria.maxLatencyMs)),
      actual: latencyMs,
      maximum: criteria?.maxLatencyMs == null ? null : Number(criteria.maxLatencyMs),
    },
    expectedOutcome: {
      pass: criteria?.expectedOutcome == null || clean(JSON.stringify(outcome)) === clean(JSON.stringify(criteria.expectedOutcome)),
      expected: criteria?.expectedOutcome ?? null,
      actual: outcome,
    },
  };

  const applicable = Object.values(checks).filter(check => check.pass !== undefined && (
    check.minimum !== undefined || check.maximum !== undefined || check.expected !== undefined || check.total !== undefined || check.verified !== undefined
  ));
  const passed = Object.values(checks).every(check => check.pass === true);

  const scoreParts = Object.values(checks).map(check => Number(Boolean(check.pass)));
  const score = Math.round((scoreParts.reduce((sum, value) => sum + value, 0) / Math.max(1, scoreParts.length)) * 100);

  const failures = Object.entries(checks)
    .filter(([, check]) => check.pass !== true)
    .map(([name, check]) => ({ name, ...check }));

  return {
    evaluated: true,
    passed,
    score,
    dimensions: checks,
    failures,
    outcomePresent: outcome !== null && outcome !== undefined,
    evidencePresent: Boolean(mission?.lastEvidence?.verified || observation?.verified),
    metrics: { quality, accuracy, cost, latencyMs },
    evaluatedAt: new Date().toISOString(),
    note: passed
      ? 'Mission met the supplied evaluation criteria.'
      : 'Mission did not meet all supplied evaluation criteria; review failures before changing any production workflow.',
  };
}

export function buildRegressionSignal({ evaluation = {}, userCorrection = '', context = {} } = {}) {
  const correction = clean(userCorrection, 500);
  const failures = Array.isArray(evaluation?.failures)
    ? evaluation.failures.slice(0, MAX_NOTES).map(item => clean(item?.name || item?.code || item, 120))
    : [];

  if (!correction && !failures.length) return null;

  return {
    type: 'regression_candidate',
    severity: correction ? 'high' : evaluation?.score < 70 ? 'high' : 'medium',
    triggeredBy: correction ? 'user_correction' : 'mission_evaluation_failure',
    correction: correction || null,
    failedDimensions: failures,
    context: {
      capability: clean(context?.capability, 120) || null,
      version: clean(context?.version, 120) || null,
      missionId: clean(context?.missionId, 120) || null,
    },
    requiresTestBeforeFix: true,
    productionWorkflowMutation: 'forbidden',
  };
}

export function detectEvaluationDegradation({ baseline = {}, current = {}, thresholds = {} } = {}) {
  const defaultDrop = 0.1;
  const watched = ['quality', 'accuracy'];
  const regressions = [];

  for (const key of watched) {
    const before = metric(baseline?.[key]);
    const after = metric(current?.[key]);
    const maxDrop = Number.isFinite(Number(thresholds?.[key])) ? Number(thresholds[key]) : defaultDrop;
    if (before === null || after === null || before <= 0) continue;
    const drop = (before - after) / before;
    if (drop >= maxDrop) regressions.push({
      metric: key,
      baseline: before,
      current: after,
      relativeDrop: Number(drop.toFixed(4)),
      threshold: maxDrop,
    });
  }

  const baselineCost = metric(baseline?.cost);
  const currentCost = metric(current?.cost);
  if (baselineCost !== null && currentCost !== null && baselineCost > 0) {
    const increase = (currentCost - baselineCost) / baselineCost;
    const maxIncrease = Number.isFinite(Number(thresholds?.costIncrease)) ? Number(thresholds.costIncrease) : 0.25;
    if (increase >= maxIncrease) regressions.push({
      metric: 'cost',
      baseline: baselineCost,
      current: currentCost,
      relativeIncrease: Number(increase.toFixed(4)),
      threshold: maxIncrease,
    });
  }

  return {
    degraded: regressions.length > 0,
    regressions,
    recommendation: regressions.length
      ? 'Open a controlled improvement candidate and compare it against the current version before activation.'
      : 'No material degradation detected under the supplied thresholds.',
  };
}

export function proposeControlledImprovement({ regression = {}, candidate = {} } = {}) {
  return {
    type: 'controlled_improvement_proposal',
    basedOn: regression?.regressions || [],
    candidate: {
      version: clean(candidate?.version, 120) || 'unversioned-candidate',
      changes: list(candidate?.changes),
      expectedImprovement: clean(candidate?.expectedImprovement, 400) || null,
    },
    safety: {
      requiresEvaluation: true,
      compareAgainstBaseline: true,
      productionActivation: 'manual_or_explicitly_authorized',
      silentCriticalWorkflowRewrite: false,
    },
  };
}

export function compareEvaluationRuns({ baseline = {}, candidate = {} } = {}) {
  const fields = ['score', 'quality', 'accuracy', 'cost', 'latencyMs'];
  const comparison = {};
  for (const field of fields) {
    const before = metric(baseline?.[field]);
    const after = metric(candidate?.[field]);
    if (before === null || after === null) continue;
    comparison[field] = {
      baseline: before,
      candidate: after,
      delta: Number((after - before).toFixed(4)),
    };
  }

  const candidateScore = metric(candidate?.score);
  const baselineScore = metric(baseline?.score);
  const improvesScore = candidateScore !== null && baselineScore !== null && candidateScore > baselineScore;
  const cheaper = metric(candidate?.cost) !== null && metric(baseline?.cost) !== null && candidate.cost <= baseline.cost;
  const faster = metric(candidate?.latencyMs) !== null && metric(baseline?.latencyMs) !== null && candidate.latencyMs <= baseline.latencyMs;

  return {
    comparison,
    preferred: improvesScore || cheaper || faster ? 'candidate' : 'baseline',
    rationale: improvesScore
      ? 'Candidate improves evaluation score.'
      : cheaper
        ? 'Candidate reduces observed cost.'
        : faster
          ? 'Candidate reduces observed latency.'
          : 'No measured advantage is established.',
  };
}

export const AGENT_EVALUATION_LIMITS = Object.freeze({
  maxNotes: MAX_NOTES,
  maxRegressionCases: MAX_REGRESSION_CASES,
});
