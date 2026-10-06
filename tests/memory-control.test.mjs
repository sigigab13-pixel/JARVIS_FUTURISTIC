import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidMemoryId,
  normalizeMemoryRecord,
  normalizeMemoryList,
  parseMemoryDeletionRequest,
} from '../server/memory-control.mjs';

const USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const MEMORY_ID = '223e4567-e89b-12d3-a456-426614174001';

test('accepts valid UUID memory ids and rejects malformed ids', () => {
  assert.equal(isValidMemoryId(MEMORY_ID), true);
  assert.equal(isValidMemoryId('memory-1'), false);
  assert.equal(isValidMemoryId(''), false);
});

test('normalizes a memory record without exposing embeddings', () => {
  const record = normalizeMemoryRecord({
    id: MEMORY_ID,
    user_id: USER_ID,
    memory_type: 'preference',
    content: 'Use a simple JARVIS domain.',
    metadata: { source: 'chat' },
    importance: 0.85,
    embedding: [1, 2, 3],
    created_at: '2026-10-06T10:00:00Z',
    last_accessed_at: null,
  });

  assert.deepEqual(record, {
    id: MEMORY_ID,
    memoryType: 'preference',
    content: 'Use a simple JARVIS domain.',
    metadata: { source: 'chat' },
    importance: 0.85,
    createdAt: '2026-10-06T10:00:00Z',
    lastAccessedAt: null,
  });
  assert.equal('embedding' in record, false);
});

test('normalizes and bounds memory lists', () => {
  const rows = Array.from({ length: 105 }, (_, index) => ({
    id: `223e4567-e89b-12d3-a456-${String(426614174000 + index).padStart(12, '0')}`,
    content: `memory ${index}`,
    memory_type: 'chat_memory',
  }));

  const list = normalizeMemoryList(rows, 100);
  assert.equal(list.length, 100);
  assert.equal(list[0].content, 'memory 0');
});

test('requires an owned memory id or explicit all=true intent', () => {
  assert.deepEqual(parseMemoryDeletionRequest({ id: MEMORY_ID }), {
    mode: 'single',
    memoryId: MEMORY_ID,
  });
  assert.deepEqual(parseMemoryDeletionRequest({ all: true, confirm: 'DELETE_ALL_MEMORY' }), { mode: 'all' });
  assert.deepEqual(parseMemoryDeletionRequest({ all: true }), {
    mode: 'invalid',
    reason: 'Deleting all memory requires explicit confirmation.',
  });
  assert.deepEqual(parseMemoryDeletionRequest({ id: 'not-a-uuid' }), {
    mode: 'invalid',
    reason: 'A valid memory id is required.',
  });
  assert.equal(parseMemoryDeletionRequest({}).mode, 'invalid');
});
