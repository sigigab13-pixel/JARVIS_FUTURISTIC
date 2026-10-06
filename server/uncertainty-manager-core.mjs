const MAX_CLARIFICATIONS = 1;
const MAX_PREVIEW_STEPS = 8;

function clean(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function uniqueStrings(values = [], max = MAX_PREVIEW_STEPS) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(value => clean(value, 220))
      .filter(Boolean)
  )].slice(0, max);
}

function hasMissingRequiredInput({ plan = {}, route = {} } = {}) {
  return Boolean(
    route?.needsClarification
    || !clean(plan?.target, 300)
    || (plan?.requestMode === 'execute' && uniqueStrings(plan?.dependencies).length === 0)
  );
}

export function assessActionUncertainty({ plan = {}, route = {}, evidence = null } = {}) {
  const mode = String(plan?.requestMode || 'answer');
  const consequential = mode === 'execute';
  const missingInput = hasMissingRequiredInput({ plan, route });
  const evidenceAvailable = Boolean(
    evidence?.webSourceCount > 0
    || evidence?.verified
    || evidence?.hasRequiredInputs
  );

  const needsClarification = missingInput && mode !== 'answer';
  const previewRequired = consequential;
  const allowedToExecute = consequential
    ? !needsClarification && Boolean(plan?.authorized === true)
    : false;

  let status = 'ready_to_answer';
  if (needsClarification) status = 'needs_clarification';
  else if (previewRequired) status = 'preview_required';
  else if (evidence?.currentSensitive && !evidenceAvailable) status = 'evidence_limited';

  return {
    status,
    requestMode: mode,
    needsClarification,
    clarificationCount: needsClarification ? MAX_CLARIFICATIONS : 0,
    previewRequired,
    allowedToExecute,
    evidenceAvailable,
    reason: needsClarification
      ? 'A required input or route clarification is missing; ask for the smallest useful detail before planning further.'
      : previewRequired
        ? 'The request is consequential; show a plan preview and require explicit authorization before execution.'
        : evidence?.currentSensitive && !evidenceAvailable
          ? 'The request is freshness-sensitive and lacks verified evidence.'
          : 'No additional uncertainty barrier is required before answering or preparing.',
  };
}

export function buildUncertaintyManagerInstruction(signal = {}) {
  if (signal?.needsClarification) {
    return [
      'UNCERTAINTY MANAGER:',
      'Do not guess the missing required input.',
      'Ask for exactly one concise clarification—the smallest detail needed to continue safely.',
      'Do not perform or claim an external action while the clarification is missing.',
    ].join('\n');
  }

  if (signal?.previewRequired) {
    return [
      'UNCERTAINTY MANAGER:',
      'This request may cause a consequential external action.',
      'Prepare a concise preview of the intended plan before execution.',
      'Do not claim authorization. Do not execute or claim execution without explicit authorization and verified completion evidence.',
    ].join('\n');
  }

  if (signal?.status === 'evidence_limited') {
    return [
      'UNCERTAINTY MANAGER:',
      'Current or verifiable information is not sufficiently evidenced.',
      'State the limitation briefly and distinguish known facts from inference.',
      'Do not invent sources or certainty.',
    ].join('\n');
  }

  return '';
}

export const UNCERTAINTY_MANAGER_LIMITS = Object.freeze({
  maxClarifications: MAX_CLARIFICATIONS,
  maxPreviewSteps: MAX_PREVIEW_STEPS,
});
