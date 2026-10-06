const DECISION_CUES = [
  /\bwe\s+decided\b/i,
  /\bfrom\s+now\s+on\b/i,
  /\bthe\s+plan\s+is\b/i,
  /\bwe(?:'ve|\s+have)?\s+chosen\b/i,
  /\bwe(?:'re|\s+are)?\s+using\b/i,
  /\buse\s+.+\s+instead\s+of\b/i,
  /\brather\s+than\b/i,
  /\bdo\s+not\s+use\b/i,
];

const RATIONALE_MARKERS = [
  'because',
  'so that',
  'since',
  'due to',
  'to avoid',
  'in order to',
];

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function firstMarkerIndex(text, markers) {
  const lower = text.toLowerCase();
  let best = -1;
  let marker = '';
  for (const candidate of markers) {
    const index = lower.indexOf(candidate);
    if (index >= 0 && (best < 0 || index < best)) {
      best = index;
      marker = candidate;
    }
  }
  return { index: best, marker };
}

function extractRejected(text) {
  const patterns = [
    /\binstead\s+of\s+(.+?)(?=\s+(?:because|so that|since|due to|to avoid|in order to)\b|[.,;]|$)/i,
    /\brather\s+than\s+(.+?)(?=\s+(?:because|so that|since|due to|to avoid|in order to)\b|[.,;]|$)/i,
    /\bdo\s+not\s+use\s+(.+?)(?=\s+(?:because|so that|since|due to|to avoid|in order to)\b|[.,;]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return null;
}

export function parseExplicitDecision(input) {
  const source = clean(input);
  if (!source || !DECISION_CUES.some(pattern => pattern.test(source))) return null;

  const { index: rationaleIndex, marker: rationaleMarker } = firstMarkerIndex(source, RATIONALE_MARKERS);
  const decisionText = rationaleIndex >= 0
    ? clean(source.slice(0, rationaleIndex))
    : source;

  const rationale = rationaleIndex >= 0
    ? clean(source.slice(rationaleIndex + rationaleMarker.length))
    : null;

  if (!decisionText) return null;

  const rejected = extractRejected(source);

  return normalizeDecisionRecord({
    decision: decisionText,
    rationale,
    rejected,
    source: 'chat',
  });
}

export function normalizeDecisionRecord(input = {}) {
  const decision = clean(input.decision);
  if (!decision) return null;

  return {
    decision: decision.slice(0, 1200),
    rationale: clean(input.rationale)?.slice(0, 1200) || null,
    rejected: clean(input.rejected)?.slice(0, 600) || null,
    scope: clean(input.scope || 'project').slice(0, 80),
    status: ['active', 'superseded'].includes(String(input.status)) ? String(input.status) : 'active',
    source: clean(input.source || 'chat').slice(0, 80),
  };
}

export function formatDecisionMemory(record) {
  const normalized = normalizeDecisionRecord(record);
  if (!normalized) return '';

  const lines = [
    '[JARVIS DECISION MEMORY]',
    'Status: ' + normalized.status,
    'Scope: ' + normalized.scope,
    'Decision: ' + normalized.decision,
  ];

  if (normalized.rationale) lines.push('Why: ' + normalized.rationale);
  if (normalized.rejected) lines.push('Rejected alternative: ' + normalized.rejected);
  lines.push('Source: ' + normalized.source);

  return lines.join('\n');
}

export function isDecisionMemory(record) {
  return Boolean(
    record
      && clean(record.decision)
      && String(record.status || 'active') === 'active',
  );
}
