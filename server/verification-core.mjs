/**
 * JARVIS Verification Core
 *
 * Rule: execution success is not the same as verified success.
 * A verification result must be derived from explicit evidence.
 */

const STATUSES = new Set(['confirmed', 'failed', 'partial', 'not_verified']);

function clean(value) {
  return String(value ?? '').trim();
}

function hasValue(value) {
  return value !== undefined && value !== null && clean(value) !== '';
}

function hasEvidence(evidence) {
  if (evidence === undefined || evidence === null) return false;
  if (typeof evidence === 'string') return evidence.trim().length > 0;
  if (Array.isArray(evidence)) return evidence.length > 0;
  if (typeof evidence === 'object') return Object.keys(evidence).length > 0;
  return true;
}

export function createVerificationResult({
  status = 'not_verified',
  message = '',
  evidence = null,
  checks = [],
} = {}) {
  const safeStatus = STATUSES.has(status) ? status : 'not_verified';
  const normalizedChecks = Array.isArray(checks)
    ? checks.map(check => ({
        name: clean(check?.name) || 'unnamed_check',
        passed: Boolean(check?.passed),
        details: hasValue(check?.details) ? clean(check.details) : undefined,
      }))
    : [];

  return {
    verified: safeStatus === 'confirmed',
    status: safeStatus,
    evidence: hasEvidence(evidence) ? evidence : null,
    checks: normalizedChecks,
    message: clean(message) || defaultMessage(safeStatus),
  };
}

function defaultMessage(status) {
  switch (status) {
    case 'confirmed':
      return 'The requested action was verified with evidence.';
    case 'failed':
      return 'The requested action failed verification.';
    case 'partial':
      return 'The requested action was only partially verified.';
    default:
      return 'The requested action has not been verified.';
  }
}

/**
 * Verify a tool result using explicit evidence.
 *
 * A tool may report success=true, but JARVIS will only mark it confirmed
 * when evidence is present and all supplied verification checks pass.
 */
export function verifyToolResult(result, checks = []) {
  const safeChecks = Array.isArray(checks) ? checks : [];
  const failedChecks = safeChecks.filter(check => !Boolean(check?.passed));
  const evidence = result?.metadata?.evidence ?? result?.evidence ?? result?.data?.evidence;
  const executionSucceeded = result?.success === true;

  if (!executionSucceeded) {
    return createVerificationResult({
      status: 'failed',
      evidence,
      checks: safeChecks,
      message: result?.error?.message || 'Tool execution failed.',
    });
  }

  if (failedChecks.length > 0) {
    return createVerificationResult({
      status: 'failed',
      evidence,
      checks: safeChecks,
      message: `Verification failed: ${failedChecks.map(check => clean(check?.name) || 'unnamed_check').join(', ')}.`,
    });
  }

  if (!hasEvidence(evidence)) {
    return createVerificationResult({
      status: 'not_verified',
      checks: safeChecks,
      message: 'The tool reported success, but supplied no evidence confirming the result.',
    });
  }

  return createVerificationResult({
    status: 'confirmed',
    evidence,
    checks: safeChecks,
  });
}

/**
 * Verify a mission outcome. This intentionally requires both a successful
 * terminal state and evidence; a status flag alone cannot unlock publishing.
 */
export function verifyMissionOutcome(mission, checks = []) {
  const status = clean(mission?.status).toLowerCase();
  const evidence = mission?.lastEvidence ?? mission?.metadata?.verificationEvidence ?? null;
  const safeChecks = Array.isArray(checks) ? checks : [];

  if (status === 'failed' || status === 'cancelled') {
    return createVerificationResult({
      status: 'failed',
      evidence,
      checks: safeChecks,
      message: `Mission ended with status "${status}".`,
    });
  }

  if (status !== 'succeeded' && status !== 'completed') {
    return createVerificationResult({
      status: 'not_verified',
      evidence,
      checks: safeChecks,
      message: `Mission is not in a verified terminal state (current status: "${status || 'unknown'}").`,
    });
  }

  return verifyToolResult(
    { success: true, metadata: { evidence } },
    safeChecks,
  );
}

export function isVerified(result) {
  return result?.verified === true && result?.status === 'confirmed' && hasEvidence(result?.evidence);
}

export const VERIFICATION_STATUSES = Object.freeze([...STATUSES]);
