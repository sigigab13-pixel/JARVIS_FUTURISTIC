const CURRENT_CUES = /\b(latest|current|today|tonight|yesterday|now|recent|recently|online|search|source|sources|verify|verified|up-to-date|up\s+to\s+date)\b/i;
const CERTAINTY_CUES = /\b(is it true|are you sure|definitely|certainly|confirm|fact-check|fact check)\b/i;
const UNCERTAINTY_CUES = /\b(i(?:'m| am)\s+(?:not\s+sure|uncertain)|i\s+don't\s+know|i\s+cannot\s+verify|i\s+can't\s+verify|cannot\s+confirm|can't\s+confirm|unclear|uncertain|may\s+be|might\s+be|could\s+be|likely|probably)\b/i;

function clean(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

export function classifyEpistemicNeed({ latestUserMessage = '', route = null } = {}) {
  const text = clean(latestUserMessage).toLowerCase();
  return {
    currentSensitive: CURRENT_CUES.test(text) || route?.mode === 'search',
    certaintyRequested: CERTAINTY_CUES.test(text),
  };
}

export function assessUncertainty({
  latestUserMessage = '',
  route = null,
  responseText = '',
  webSearchUsed = false,
} = {}) {
  const need = classifyEpistemicNeed({ latestUserMessage, route });
  const answer = clean(responseText, 12000);
  const uncertaintyExpressed = UNCERTAINTY_CUES.test(answer);

  let level = 'normal';
  let reason = 'No special freshness or certainty signal was required.';
  let liveEvidence = Boolean(webSearchUsed);
  let shouldSignal = false;

  if (need.currentSensitive && liveEvidence) {
    level = 'supported';
    reason = 'The response used live web-search evidence for a freshness-sensitive request.';
  } else if (need.currentSensitive && !liveEvidence) {
    level = 'limited';
    reason = 'The request depends on current or verifiable information, but live web search was not used.';
    shouldSignal = true;
  } else if (need.certaintyRequested && !uncertaintyExpressed) {
    level = 'limited';
    reason = 'The user requested strong certainty, but no live evidence signal is available.';
    shouldSignal = true;
  } else if (uncertaintyExpressed) {
    level = 'cautious';
    reason = 'The response explicitly signals uncertainty rather than presenting a guess as certain.';
  }

  return {
    level,
    reason,
    currentSensitive: need.currentSensitive,
    certaintyRequested: need.certaintyRequested,
    uncertaintyExpressed,
    liveEvidence,
    shouldSignal,
  };
}

export function buildEpistemicInstruction(signal) {
  const currentSensitive = Boolean(signal?.currentSensitive);
  const certaintyRequested = Boolean(signal?.certaintyRequested);
  if (!currentSensitive && !certaintyRequested) return '';

  return [
    'EPISTEMIC SAFETY:',
    currentSensitive && !signal?.liveEvidence
      ? 'Live verification was not performed for this freshness-sensitive request. Do not present current details as verified. State the limitation briefly and use uncertainty-aware wording.'
      : 'Separate verified information from inference. Do not claim more certainty than the available evidence supports.',
    certaintyRequested
      ? 'The user is asking for certainty. Do not manufacture confidence; say when the evidence is insufficient.'
      : null,
    'When you genuinely do not know, say so plainly rather than guessing.',
    'Never invent citations, sources, browsing, or verification.',
  ].filter(Boolean).join('\n');
}

export const UNCERTAINTY_LIMITS = {
  maxInputLength: 4000,
  maxResponseLength: 12000,
};