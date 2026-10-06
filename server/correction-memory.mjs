function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizePair(previous, current) {
  return {
    previous: clean(previous).replace(/^['"]|['"]$/g, '').slice(0, 300) || null,
    current: clean(current).replace(/^['"]|['"]$/g, '').slice(0, 300) || null,
  };
}

export function parseUserCorrection(input) {
  const source = clean(input);
  if (!source) return null;

  let match = source.match(/^my\s+name\s+(?:is|was)\s+not\s+(.+?),?\s+(?:it'?s|it is|use)\s+(.+?)\s*[.!]?$/i);
  if (match) {
    const pair = normalizePair(match[1], match[2]);
    return {
      kind: 'correction',
      scope: 'identity',
      field: 'name',
      ...pair,
      statement: 'The user says their name should be ' + pair.current + ', not ' + pair.previous + '.',
      source: 'explicit_user_correction',
    };
  }

  match = source.match(/^my\s+name\s+is\s+(.+?),?\s+not\s+(.+?)\s*[.!]?$/i);
  if (match) {
    const pair = normalizePair(match[2], match[1]);
    return {
      kind: 'correction',
      scope: 'identity',
      field: 'name',
      ...pair,
      statement: 'The user says their name should be ' + pair.current + ', not ' + pair.previous + '.',
      source: 'explicit_user_correction',
    };
  }

  match = source.match(/^my\s+name\s+is\s+(.+?),?\s+not\s+(.+?)\s*[.!]?$/i);
  if (match) {
    const pair = normalizePair(match[2], match[1]);
    return {
      kind: 'correction',
      scope: 'identity',
      field: 'name',
      ...pair,
      statement: 'The user says their name should be ' + pair.current + ', not ' + pair.previous + '.',
      source: 'explicit_user_correction',
    };
  }

  match = source.match(/^don'?t\s+call\s+me\s+(.+?),?\s+(?:call|use)\s+me\s+(.+?)\s*[.!]?$/i);
  if (match) {
    const pair = normalizePair(match[1], match[2]);
    return {
      kind: 'correction',
      scope: 'identity',
      field: 'name',
      ...pair,
      statement: 'The user says they should be addressed as ' + pair.current + ', not ' + pair.previous + '.',
      source: 'explicit_user_correction',
    };
  }

  match = source.match(/^i\s+(?:said|wrote|told you)\s+(.+?),?\s+but\s+i\s+meant\s+(.+?)\s*[.!]?$/i);
  if (match) {
    const pair = normalizePair(match[1], match[2]);
    return {
      kind: 'correction',
      scope: 'general',
      field: null,
      ...pair,
      statement: 'The user corrected an earlier statement: ' + pair.current + ' is the intended value, not ' + pair.previous + '.',
      source: 'explicit_user_correction',
    };
  }

  match = source.match(/^correction\s*:\s*(.+)$/i);
  if (match) {
    const statement = clean(match[1]).slice(0, 1000);
    return {
      kind: 'correction',
      scope: 'general',
      field: null,
      previous: null,
      current: statement,
      statement: 'The user explicitly corrected prior information. Use this corrected statement as current user truth: ' + statement,
      source: 'explicit_user_correction',
    };
  }

  match = source.match(/^([A-Za-z][A-Za-z'-]{1,40})\s+not\s+([A-Za-z][A-Za-z'-]{1,40})\s*[.!]?$/);
  if (match) {
    const pair = normalizePair(match[2], match[1]);
    return {
      kind: 'correction',
      scope: 'general',
      field: null,
      ...pair,
      statement: 'The user says ' + pair.current + ' is correct, not ' + pair.previous + '.',
      source: 'explicit_user_correction',
    };
  }

  return null;
}

export function formatCorrectionMemory(record) {
  if (!record || record.kind !== 'correction') return '';
  const statement = clean(record.statement);
  if (!statement) return '';

  const lines = [
    '[JARVIS CORRECTION MEMORY]',
    'Status: active',
    'Scope: ' + clean(record.scope || 'general').slice(0, 80),
    'Correction: ' + statement.slice(0, 1200),
    'Source: ' + clean(record.source || 'explicit_user_correction').slice(0, 80),
  ];

  if (record.previous) lines.push('Superseded value: ' + clean(record.previous).slice(0, 300));
  if (record.current) lines.push('Current value: ' + clean(record.current).slice(0, 500));

  return lines.join('\n');
}

export function isExplicitCorrection(record) {
  return Boolean(
    record
      && record.kind === 'correction'
      && clean(record.statement),
  );
}
