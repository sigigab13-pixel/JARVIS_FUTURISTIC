const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidMemoryId(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function normalizeMemoryRecord(row) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || '').trim();
  if (!isValidMemoryId(id)) return null;

  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata
    : {};

  return {
    id,
    memoryType: String(row.memory_type || 'semantic').trim() || 'semantic',
    content: String(row.content || '').trim(),
    metadata,
    importance: Number.isFinite(Number(row.importance)) ? Number(row.importance) : 0.5,
    createdAt: row.created_at || null,
    lastAccessedAt: row.last_accessed_at || null,
  };
}

export function normalizeMemoryList(rows, limit = 50) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeMemoryRecord)
    .filter(Boolean)
    .filter(item => item.content)
    .slice(0, safeLimit);
}

export function parseMemoryDeletionRequest(body = {}) {
  const memoryId = String(body?.id || '').trim();
  if (memoryId) {
    return isValidMemoryId(memoryId)
      ? { mode: 'single', memoryId }
      : { mode: 'invalid', reason: 'A valid memory id is required.' };
  }

  if (body?.all === true) {
    return { mode: 'all' };
  }

  return { mode: 'invalid', reason: 'Provide a memory id or set all=true.' };
}
