function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function comparable(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeId(value, fallback) {
  const id = clean(value);
  return id || fallback;
}

function extractNameFact(memory) {
  if (!memory || typeof memory !== 'object') return null;

  const metadata = memory.metadata && typeof memory.metadata === 'object'
    ? memory.metadata
    : {};

  if (String(metadata.field || '').toLowerCase() === 'name' && clean(metadata.current)) {
    return { value: clean(metadata.current), source: 'metadata' };
  }

  const content = clean(memory.content);
  const patterns = [
    /^my\s+name\s+is\s+([^,.!?]+?)(?:\s+not\s+[^,.!?]+)?[.!?]?$/i,
    /^call\s+me\s+([^,.!?]+)[.!?]?$/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return { value: clean(match[1]), source: 'content' };
  }

  return null;
}

function getPriority(memory) {
  const type = String(memory?.memory_type || memory?.memoryType || '').toLowerCase();
  if (type === 'correction') return 100;
  if (type === 'decision') return 90;
  if (type === 'project_decision') return 85;
  if (type === 'identity') return 80;
  return Number.isFinite(Number(memory?.importance)) ? Number(memory.importance) * 100 : 50;
}

export function detectMemoryContradictions(memories = []) {
  const rows = Array.isArray(memories) ? memories.filter(Boolean) : [];
  const conflicts = [];

  const nameFacts = rows
    .map((memory, index) => {
      const fact = extractNameFact(memory);
      return fact
        ? {
            id: normalizeId(memory.id, String(index)),
            value: fact.value,
            normalized: comparable(fact.value),
            memory,
            priority: getPriority(memory),
          }
        : null;
    })
    .filter(Boolean);

  const nameGroups = new Map();
  for (const fact of nameFacts) {
    if (!fact.normalized) continue;
    const list = nameGroups.get(fact.normalized) || [];
    list.push(fact);
    nameGroups.set(fact.normalized, list);
  }

  if (nameGroups.size > 1) {
    const candidates = [...nameGroups.values()].flat();
    const correction = candidates.find(
      item => String(item.memory?.memory_type || item.memory?.memoryType || '').toLowerCase() === 'correction'
    );
    const preferred = [...candidates].sort((a, b) => b.priority - a.priority)[0];
    const winner = correction || preferred;

    conflicts.push({
      code: 'IDENTITY_CONFLICT',
      field: 'name',
      memoryIds: candidates.map(item => item.id),
      values: [...nameGroups.values()].map(group => group[0].value),
      preferredMemoryId: winner?.id || null,
      resolution: winner
        ? 'Prefer the highest-priority explicit correction or strongest current identity fact; do not silently delete the conflicting record.'
        : 'Do not guess between conflicting identity values.',
    });
  }

  const fieldFacts = new Map();
  for (const memory of rows) {
    const metadata = memory?.metadata && typeof memory.metadata === 'object'
      ? memory.metadata
      : {};
    const field = clean(metadata.field).toLowerCase();
    const current = clean(metadata.current);
    if (!field || !current) continue;

    const list = fieldFacts.get(field) || [];
    list.push({
      id: normalizeId(memory.id, String(list.length)),
      value: current,
      normalized: comparable(current),
      memory,
      priority: getPriority(memory),
    });
    fieldFacts.set(field, list);
  }

  for (const [field, facts] of fieldFacts.entries()) {
    const distinct = new Map();
    for (const fact of facts) {
      if (!fact.normalized) continue;
      const list = distinct.get(fact.normalized) || [];
      list.push(fact);
      distinct.set(fact.normalized, list);
    }
    if (distinct.size <= 1 || field === 'name') continue;

    const candidates = [...distinct.values()].flat();
    const winner = [...candidates].sort((a, b) => b.priority - a.priority)[0];
    conflicts.push({
      code: 'STRUCTURED_FIELD_CONFLICT',
      field,
      memoryIds: candidates.map(item => item.id),
      values: [...distinct.values()].map(group => group[0].value),
      preferredMemoryId: winner?.id || null,
      resolution: winner
        ? 'Prefer the highest-priority current value, especially an explicit correction, and do not delete history.'
        : 'Do not guess between conflicting structured values.',
    });
  }

  const decisionFacts = rows
    .filter(memory => ['decision', 'project_decision'].includes(String(memory?.memory_type || memory?.memoryType || '').toLowerCase()))
    .map((memory, index) => {
      const metadata = memory?.metadata && typeof memory.metadata === 'object' ? memory.metadata : {};
      const decision = clean(metadata.decision);
      const scope = clean(metadata.scope || 'project').toLowerCase();
      return decision
        ? {
            id: normalizeId(memory.id, String(index)),
            decision,
            normalized: comparable(decision),
            scope,
            memory,
            priority: getPriority(memory),
          }
        : null;
    })
    .filter(Boolean);

  const decisionsByScope = new Map();
  for (const fact of decisionFacts) {
    const list = decisionsByScope.get(fact.scope) || [];
    list.push(fact);
    decisionsByScope.set(fact.scope, list);
  }

  for (const [scope, facts] of decisionsByScope.entries()) {
    const distinct = new Map();
    for (const fact of facts) {
      if (!fact.normalized) continue;
      const list = distinct.get(fact.normalized) || [];
      list.push(fact);
      distinct.set(fact.normalized, list);
    }
    if (distinct.size <= 1) continue;

    const candidates = [...distinct.values()].flat();
    const winner = [...candidates].sort((a, b) => b.priority - a.priority)[0];
    conflicts.push({
      code: 'DECISION_CONFLICT',
      field: 'decision',
      scope,
      memoryIds: candidates.map(item => item.id),
      values: [...distinct.values()].map(group => group[0].decision),
      preferredMemoryId: winner?.id || null,
      resolution: 'Do not silently resurrect a rejected or superseded project decision. Prefer the active higher-priority decision and explain uncertainty when the conflict matters.',
    });
  }

  const preferredMemoryIds = [...new Set(conflicts.map(item => item.preferredMemoryId).filter(Boolean))];

  return {
    hasContradictions: conflicts.length > 0,
    count: conflicts.length,
    conflicts,
    preferredMemoryIds,
  };
}

export function buildContradictionInstruction(result) {
  if (!result?.hasContradictions) return '';

  const lines = [
    'Memory consistency warning: the retrieved long-term memory contains conflicting records.',
    'Do not invent a resolution or silently delete history.',
    'Prefer an explicit correction memory over older conflicting user memories.',
    'For unresolved conflicts, do not state the conflicting value as certain; ask for clarification only when the conflict materially affects the answer.',
  ];

  for (const conflict of result.conflicts.slice(0, 4)) {
    lines.push(
      '- ' + conflict.code + ' on ' + conflict.field + ': preferred memory ' +
      String(conflict.preferredMemoryId || 'none') + '.',
    );
  }

  return lines.join('\n');
}

export { comparable as normalizeComparableMemoryValue };
