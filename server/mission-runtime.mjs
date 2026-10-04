const TERMINAL = new Set(['succeeded', 'failed', 'canceled']);

const transitions = {
  draft: new Set(['queued', 'waiting_approval', 'canceled']),
  queued: new Set(['running', 'paused', 'canceled']),
  running: new Set(['waiting_approval', 'paused', 'succeeded', 'failed', 'canceled']),
  waiting_approval: new Set(['running', 'paused', 'canceled', 'failed']),
  paused: new Set(['queued', 'running', 'canceled']),
  blocked: new Set(['queued', 'canceled']),
  succeeded: new Set(),
  failed: new Set(['queued', 'canceled']),
  canceled: new Set(),
};

export function canTransition(from, to) {
  return Boolean(transitions[String(from)]?.has(String(to)));
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid mission transition: ${String(from)} -> ${String(to)}`);
  }
  return true;
}

export function createMissionState({
  missionId,
  userId = null,
  goal = '',
  autonomy = 'advise',
  steps = [],
} = {}) {
  const normalizedSteps = Array.isArray(steps)
    ? steps.slice(0, 30).map((step, index) => ({
        id: String(step?.id || `step-${index + 1}`).slice(0, 100),
        title: String(step?.title || `Step ${index + 1}`).slice(0, 200),
        capability: String(step?.capability || 'unknown').slice(0, 100),
        status: String(step?.status || 'pending'),
        executorType: String(step?.executorType || step?.executor_type || step?.type || '').slice(0, 100),
        sideEffect: step?.sideEffect === true || step?.side_effect === true,
        prompt: String(step?.prompt || '').slice(0, 4000),
        priority: Math.min(100, Math.max(0, Number(step?.priority ?? 50))),
        maxAttempts: Math.min(8, Math.max(1, Number(step?.maxAttempts ?? step?.max_attempts ?? 3))),
        input: step?.input && typeof step.input === 'object' && !Array.isArray(step.input) ? step.input : {},
      }))
    : [];

  return {
    id: String(missionId || ''),
    userId: userId ? String(userId) : null,
    goal: String(goal || '').trim().slice(0, 2000),
    autonomy: String(autonomy || 'advise'),
    status: 'draft',
    currentStep: normalizedSteps.findIndex(step => step.status !== 'succeeded'),
    steps: normalizedSteps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function transitionMission(state, nextStatus) {
  const current = String(state?.status || 'draft');
  const next = String(nextStatus || '');
  assertTransition(current, next);
  const updated = {
    ...state,
    status: next,
    updatedAt: new Date().toISOString(),
  };
  if (TERMINAL.has(next)) updated.completedAt = updated.updatedAt;
  return updated;
}

export function advanceMissionStep(state) {
  if (!state || !Array.isArray(state.steps)) throw new Error('Mission state is invalid.');
  const index = Number(state.currentStep);
  if (!Number.isInteger(index) || index < 0 || index >= state.steps.length) {
    return transitionMission(state, 'succeeded');
  }

  const steps = state.steps.map((step, stepIndex) =>
    stepIndex === index ? { ...step, status: 'succeeded' } : step
  );
  const nextIndex = steps.findIndex(step => step.status !== 'succeeded');
  const next = { ...state, steps, currentStep: nextIndex, updatedAt: new Date().toISOString() };
  if (nextIndex < 0) return transitionMission(next, 'succeeded');
  return next;
}

export function normalizeMissionForStorage(state) {
  return {
    mission_id: state.id,
    goal: state.goal,
    autonomy: state.autonomy,
    status: state.status,
    current_step: state.currentStep,
    steps: state.steps,
    approval: state.approval && typeof state.approval === 'object' ? state.approval : {},
    last_evidence: state.lastEvidence && typeof state.lastEvidence === 'object' ? state.lastEvidence : {},
    metadata: state.metadata && typeof state.metadata === 'object' ? state.metadata : {},
    created_at: state.createdAt,
    updated_at: state.updatedAt,
    completed_at: state.completedAt || null,
  };
}
