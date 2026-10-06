const MAX_STEPS = 8;
const MAX_TEXT = 500;
const MODES = new Set(['answer', 'decide', 'prepare', 'execute']);

function clean(value, max = MAX_TEXT) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function classifyRequestMode(text) {
  const value = text.toLowerCase();
  if (/\b(help me decide|should i|which (one|option)|compare|choose)\b/.test(value)) return 'decide';
  if (/\b(prepare|draft|write|make|create)\b/.test(value) && !/\b(send|publish|book|buy|delete|apply)\b/.test(value)) return 'prepare';
  if (/\b(do it|actually do|send|publish|book|buy|delete|apply|run|execute|submit)\b/.test(value)) return 'execute';
  return 'answer';
}

function extractConstraints(text) {
  const constraints = [];
  const patterns = [
    /\b(?:under|below|less than)\s+[$€£₦]?\s*\d+(?:\.\d+)?\b[^,.!?]*/i,
    /\b(?:by|before|within)\s+(?:today|tomorrow|tonight|\d+\s+(?:days?|hours?|weeks?))\b[^,.!?]*/i,
    /\b(?:using|with|without)\s+[^,.!?]+/i,
    /\b(?:free|cheap|lowest cost|no subscription|no extra cost)\b[^,.!?]*/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) constraints.push(clean(match[0]));
  }
  return [...new Set(constraints)].slice(0, 6);
}

function extractTarget(text) {
  const cleaned = clean(text);
  const stripped = cleaned
    .replace(/^(please\s+)?(help me|can you|could you|i need you to|i want you to)\s+/i, '')
    .replace(/^(answer|prepare|create|make|write|do|execute|run)\s+/i, '');
  return clean(stripped || cleaned);
}

function buildSubtasks(target, mode) {
  const steps = [
    'Clarify the requested outcome',
    'Identify constraints and required inputs',
    'Choose the smallest viable workflow',
    'Check permissions and dependencies',
    'Produce or execute the requested result',
    'Verify the result against the completion criteria',
  ];
  if (mode === 'answer') return [steps[0], 'Answer using available evidence'];
  if (mode === 'decide') return [steps[0], 'Compare the relevant options and trade-offs', 'Recommend the best-supported option'];
  if (mode === 'prepare') return [steps[0], steps[1], 'Prepare the requested artifact', steps[5]];
  return [steps[0], steps[1], steps[3], steps[4], steps[5]];
}

function buildDependencies(mode) {
  const base = ['Required user context'];
  if (mode === 'decide') base.push('Comparable option data');
  if (mode === 'prepare') base.push('Required source material or inputs');
  if (mode === 'execute') base.push('Explicit authorization for consequential external actions');
  return base;
}

function buildCompletion(mode, target) {
  if (mode === 'answer') return `The answer addresses “${target}” and clearly separates evidence from inference.`;
  if (mode === 'decide') return `The options are compared, trade-offs are stated, and one recommendation is supported by evidence.`;
  if (mode === 'prepare') return `The requested artifact is produced, checked, and ready for user review or the next approved step.`;
  return `The requested action is completed only within authorized scope, and the result has verified evidence.`;
}

export function planGoal(input = {}) {
  const request = clean(input.request);
  if (!request) throw new Error('GOAL_REQUEST_REQUIRED');

  const mode = classifyRequestMode(request);
  const constraints = Array.isArray(input.constraints)
    ? input.constraints.map(value => clean(value, 200)).filter(Boolean).slice(0, 6)
    : extractConstraints(request);
  const target = clean(input.target || extractTarget(request), 300);
  const subtasks = buildSubtasks(target, mode).slice(0, MAX_STEPS);
  const dependencies = [
    ...buildDependencies(mode),
    ...(Array.isArray(input.dependencies)
      ? input.dependencies.map(value => clean(value, 200)).filter(Boolean).slice(0, 4)
      : []),
  ].filter((value, index, values) => values.indexOf(value) === index);

  return {
    target,
    requestMode: mode,
    constraints,
    subtasks,
    dependencies,
    completionDefinition: buildCompletion(mode, target),
    executionPolicy: mode === 'execute'
      ? 'plan_then_authorize_then_execute_then_verify'
      : 'plan_and_return',
    bounded: true,
    maxSteps: MAX_STEPS,
  };
}

export function replanGoal(plan, evidence = {}) {
  if (!plan || typeof plan !== 'object') throw new Error('GOAL_PLAN_REQUIRED');
  const changes = Array.isArray(evidence?.changes)
    ? evidence.changes.map(value => clean(value, 200)).filter(Boolean).slice(0, 6)
    : [];
  if (!changes.length) return { ...plan, replanned: false, evidenceApplied: [] };

  return {
    ...plan,
    subtasks: [
      'Review new evidence and identify what changed',
      ...(plan.subtasks || []).slice(0, MAX_STEPS - 2),
      'Verify the revised outcome against the completion criteria',
    ].slice(0, MAX_STEPS),
    dependencies: [...new Set([...(plan.dependencies || []), ...changes])].slice(0, 10),
    replanned: true,
    evidenceApplied: changes,
  };
}

export const GOAL_OUTCOME_MODES = Object.freeze([...MODES]);
export const GOAL_OUTCOME_LIMITS = Object.freeze({ maxSteps: MAX_STEPS, maxText: MAX_TEXT });
