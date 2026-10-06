const SAFE_RECOVERY_ACTIONS = Object.freeze({
  configuration: 'report_configuration_gap',
  transient: 'bounded_retry',
  dependency: 'degrade_optional_dependency',
  authentication: 'require_reauthentication',
  authorization: 'deny_and_escalate',
  unknown: 'stop_and_escalate',
});

const TERMINAL_FAILURES = new Set(['authorization', 'unknown']);

export function classifyRepairFailure({ category = 'unknown', retryable = false } = {}) {
  const normalized = String(category || 'unknown').trim().toLowerCase();
  if (!Object.hasOwn(SAFE_RECOVERY_ACTIONS, normalized)) return 'unknown';
  if (TERMINAL_FAILURES.has(normalized)) return normalized;
  if (normalized === 'transient' && !retryable) return 'unknown';
  return normalized;
}

export function buildRepairDecision({ category = 'unknown', retryable = false, attempts = 0, maxAttempts = 3 } = {}) {
  const normalizedAttempts = Number.isInteger(attempts) && attempts >= 0 ? attempts : 0;
  const normalizedMax = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3;
  const failureClass = classifyRepairFailure({ category, retryable });

  if (failureClass === 'transient' && normalizedAttempts < normalizedMax) {
    return {
      status: 'recoverable',
      action: SAFE_RECOVERY_ACTIONS.transient,
      attempt: normalizedAttempts + 1,
      maxAttempts: normalizedMax,
      terminal: false,
    };
  }

  return {
    status: 'escalate',
    action: SAFE_RECOVERY_ACTIONS[failureClass] || SAFE_RECOVERY_ACTIONS.unknown,
    attempt: normalizedAttempts,
    maxAttempts: normalizedMax,
    terminal: true,
  };
}

export function getRepairOfficePolicy() {
  return {
    autonomousMutation: false,
    maxRetryAttempts: 3,
    safeActions: { ...SAFE_RECOVERY_ACTIONS },
    parentLaws: [1, 3, 4, 5, 23, 26, 27],
  };
}
