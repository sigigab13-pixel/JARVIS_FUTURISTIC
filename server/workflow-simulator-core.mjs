const MAX_STEPS = 8;
const MAX_ALTERNATIVES = 4;

function clean(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values, max = MAX_STEPS) {
  return [...new Set(values.map(value => clean(value, 220)).filter(Boolean))].slice(0, max);
}

function normalizeCapabilities(capabilities = []) {
  return asArray(capabilities).map(item => ({
    id: clean(item?.id, 100),
    label: clean(item?.label || item?.id, 120),
    available: item?.available !== false,
  })).filter(item => item.id);
}

function normalizeStep(step, index, requestMode = 'answer') {
  const sideEffect = Boolean(step?.sideEffect ?? step?.side_effect ?? (
    requestMode === 'execute' && /\b(send|publish|book|buy|delete|apply|submit|cancel|charge|transfer)\b/i.test(String(step?.title || ''))
  ));
  return {
    id: clean(step?.id || `step-${index + 1}`, 100),
    title: clean(step?.title || step?.name || `Step ${index + 1}`, 220),
    capability: clean(step?.capability || '', 100),
    executorType: clean(step?.executorType || step?.executor_type || step?.type || '', 100),
    sideEffect,
    permissions: unique(asArray(step?.permissions || step?.requiredPermissions), 4),
    dependencies: unique(asArray(step?.dependencies || step?.dependsOn || step?.depends_on), 6),
    estimatedCost: Number.isFinite(Number(step?.estimatedCost)) ? Math.max(0, Number(step.estimatedCost)) : null,
    requiredInputs: unique(asArray(step?.requiredInputs || step?.required_inputs), 6),
  };
}

function deriveSteps(plan, mission) {
  if (mission && Array.isArray(mission.steps)) {
    return mission.steps.slice(0, MAX_STEPS).map((step, index) =>
      normalizeStep(step, index, String(mission.autonomy || 'advise') === 'execute_with_approval' ? 'execute' : 'prepare')
    );
  }

  const requestMode = String(plan?.requestMode || 'answer');
  const subtasks = asArray(plan?.subtasks).slice(0, MAX_STEPS);
  return subtasks.map((title, index) => normalizeStep({
    id: `plan-${index + 1}`,
    title,
    capability: 'chat',
    executorType: 'reasoning',
    sideEffect: requestMode === 'execute' && index === Math.max(0, subtasks.length - 2),
  }, index, requestMode));
}

function capabilityLookup(capabilities) {
  return new Map(normalizeCapabilities(capabilities).map(item => [item.id, item]));
}

function assessStep(step, index, { capabilities, supportedAdapters, approvalStatus, requestMode }) {
  const capabilityMap = capabilityLookup(capabilities);
  const failures = [];
  const adapter = step.executorType;
  const capability = step.capability;
  const registered = capability ? capabilityMap.get(capability) : null;

  if (adapter && Array.isArray(supportedAdapters) && supportedAdapters.length && !supportedAdapters.includes(adapter)) {
    failures.push({
      code: 'UNSUPPORTED_ADAPTER',
      message: `Executor adapter "${adapter}" is not supported.`,
    });
  }

  if (registered && registered.available === false) {
    failures.push({
      code: 'CAPABILITY_UNAVAILABLE',
      message: `Capability "${capability}" is not currently configured.`,
    });
  }

  if (!adapter && !capability) {
    failures.push({
      code: 'EXECUTOR_UNSPECIFIED',
      message: 'The workflow step has no concrete executor or capability.',
    });
  }

  if (step.requiredInputs.length) {
    failures.push({
      code: 'INPUT_DEPENDENCY',
      message: `Required inputs: ${step.requiredInputs.join(', ')}.`,
    });
  }

  if (step.sideEffect) {
    if (requestMode !== 'execute') {
      failures.push({
        code: 'AUTHORIZATION_REQUIRED',
        message: 'This step can change an external system and needs explicit authorization.',
      });
    } else if (approvalStatus !== 'approved') {
      failures.push({
        code: 'APPROVAL_REQUIRED',
        message: 'This side-effect step is blocked until explicit approval is recorded.',
      });
    }
  }

  if (index > 0 && !step.dependencies.length) {
    step.dependencies.push(`step-${index}`);
  }

  const risk = step.sideEffect ? 'high' : failures.some(item => ['UNSUPPORTED_ADAPTER', 'CAPABILITY_UNAVAILABLE'].includes(item.code)) ? 'medium' : 'low';

  return {
    ...step,
    index,
    dependencies: step.dependencies,
    permissions: step.permissions.length ? step.permissions : (capability ? [`use:${capability}`] : []),
    failurePoints: failures,
    risk,
    canProceedInDryRun: failures.every(item => !['UNSUPPORTED_ADAPTER', 'CAPABILITY_UNAVAILABLE'].includes(item.code)),
  };
}

function buildPreview(steps) {
  const titles = steps.map(step => step.title).filter(Boolean);
  return titles.length ? `I plan to do ${titles.join(' → ')}.` : 'No executable workflow steps were supplied.';
}

function calculateSummary(steps, { requestMode, approvalStatus }) {
  const failurePoints = steps.flatMap(step => step.failurePoints.map(item => ({ stepIndex: step.index, ...item })));
  const approvalRequired = steps.some(step => step.sideEffect);
  const blocked = failurePoints.some(item => ['UNSUPPORTED_ADAPTER', 'CAPABILITY_UNAVAILABLE', 'APPROVAL_REQUIRED', 'AUTHORIZATION_REQUIRED'].includes(item.code));
  const estimatedCostValues = steps.map(step => step.estimatedCost).filter(value => Number.isFinite(value));
  const estimatedCost = estimatedCostValues.length
    ? estimatedCostValues.reduce((total, value) => total + value, 0)
    : null;

  return {
    requestMode,
    approvalRequired,
    approvalStatus,
    blocked,
    externalSideEffectsBlocked: true,
    failurePointCount: failurePoints.length,
    failurePoints,
    estimatedCost,
    costKnown: estimatedCost !== null && estimatedCostValues.length === steps.length,
    risk: steps.some(step => step.risk === 'high') ? 'high' : steps.some(step => step.risk === 'medium') ? 'medium' : 'low',
  };
}

export function simulateWorkflow({ plan = {}, mission = null, capabilities = [], supportedAdapters = [], approvalStatus = null } = {}) {
  const requestMode = String(mission?.autonomy || plan?.requestMode || 'answer') === 'execute_with_approval'
    ? 'execute'
    : String(mission?.autonomy || plan?.requestMode || 'answer');

  const effectiveApprovalStatus = String(
    approvalStatus
    || mission?.approval?.status
    || plan?.approvalStatus
    || ''
  ).toLowerCase() || 'not_granted';

  const rawSteps = deriveSteps(plan, mission);
  const steps = rawSteps.map((step, index) =>
    assessStep({ ...step }, index, {
      capabilities,
      supportedAdapters,
      approvalStatus: effectiveApprovalStatus,
      requestMode,
    })
  );
  const summary = calculateSummary(steps, {
    requestMode,
    approvalStatus: effectiveApprovalStatus,
  });

  return {
    mode: 'dry_run',
    simulated: true,
    sideEffectsExecuted: false,
    preview: buildPreview(steps),
    steps,
    summary,
    selectedRoute: {
      strategy: 'safest_effective_route',
      score: calculateRouteScore(summary, steps),
    },
    limits: {
      maxSteps: MAX_STEPS,
      externalSideEffects: 'blocked',
      productionWrites: 'blocked',
    },
  };
}

function calculateRouteScore(summary, steps) {
  let score = 100;
  score -= summary.failurePointCount * 12;
  score -= steps.filter(step => step.risk === 'high').length * 15;
  if (summary.estimatedCost !== null) score -= Math.min(20, summary.estimatedCost / 10);
  score -= Math.max(0, steps.length - 4) * 2;
  return Math.max(0, Math.round(score));
}

export function compareWorkflowPlans({ plans = [], capabilities = [], supportedAdapters = [] } = {}) {
  const candidates = asArray(plans).slice(0, MAX_ALTERNATIVES).map((plan, index) => {
    const simulation = simulateWorkflow({
      plan,
      capabilities,
      supportedAdapters,
    });
    const score = simulation.selectedRoute.score;
    const effective = !simulation.summary.blocked;
    return {
      index,
      label: clean(plan?.label || `Plan ${index + 1}`, 120),
      effective,
      score,
      risk: simulation.summary.risk,
      estimatedCost: simulation.summary.estimatedCost,
      failurePointCount: simulation.summary.failurePointCount,
      preview: simulation.preview,
      simulation,
    };
  }).sort((a, b) => Number(b.effective) - Number(a.effective) || b.score - a.score || a.failurePointCount - b.failurePointCount);

  return {
    compared: candidates.length,
    selectedIndex: candidates.length ? candidates[0].index : null,
    selectionReason: candidates.length
      ? (candidates[0].effective
        ? 'Selected the safest effective route.'
        : 'No route is fully effective; selected the least-blocked route for review.')
      : 'No alternative workflow plans were supplied.',
    alternatives: candidates,
  };
}

export const WORKFLOW_SIMULATOR_LIMITS = Object.freeze({
  maxSteps: MAX_STEPS,
  maxAlternatives: MAX_ALTERNATIVES,
});
