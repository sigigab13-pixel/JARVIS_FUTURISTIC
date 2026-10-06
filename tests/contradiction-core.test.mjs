import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectMemoryContradictions,
  buildContradictionInstruction,
  normalizeComparableMemoryValue,
} from '../server/contradiction-core.mjs';

const memory = (id, type, content, metadata = {}, importance = 0.8) => ({
  id,
  memory_type: type,
  content,
  metadata,
  importance,
});

test('detects conflicting identity names', () => {
  const result = detectMemoryContradictions([
    memory('name-a', 'identity', 'My name is Atlas.'),
    memory('name-b', 'identity', 'My name is Nova.'),
  ]);

  assert.equal(result.hasContradictions, true);
  assert.equal(result.count, 1);
  assert.equal(result.conflicts[0].code, 'IDENTITY_CONFLICT');
  assert.equal(result.conflicts[0].field, 'name');
});

test('prefers an explicit correction over an older conflicting identity memory', () => {
  const result = detectMemoryContradictions([
    memory('old', 'identity', 'My name is Nova.', {}, 0.95),
    memory('new', 'correction', '[JARVIS CORRECTION MEMORY]', {
      field: 'name',
      current: 'Atlas',
      previous: 'Nova',
    }, 0.99),
  ]);

  assert.equal(result.hasContradictions, true);
  assert.equal(result.conflicts[0].preferredMemoryId, 'new');
});

test('detects structured field conflicts without mutation', () => {
  const result = detectMemoryContradictions([
    memory('a', 'correction', 'Current preference: simple domain.', { field: 'domain', current: 'simple domain' }),
    memory('b', 'correction', 'Current preference: complex domain.', { field: 'domain', current: 'complex domain' }),
  ]);

  assert.equal(result.hasContradictions, true);
  assert.ok(result.conflicts.some(item => item.code === 'STRUCTURED_FIELD_CONFLICT'));
});

test('detects conflicting active decisions within the same scope', () => {
  const result = detectMemoryContradictions([
    memory('d1', 'decision', 'Use plan A.', { decision: 'Use plan A', scope: 'project' }),
    memory('d2', 'decision', 'Use plan B.', { decision: 'Use plan B', scope: 'project' }),
  ]);

  assert.equal(result.hasContradictions, true);
  assert.ok(result.conflicts.some(item => item.code === 'DECISION_CONFLICT'));
});

test('does not flag duplicate equivalent facts', () => {
  const result = detectMemoryContradictions([
    memory('a', 'identity', 'My name is Atlas.'),
    memory('b', 'identity', 'My name is atlas!'),
  ]);

  assert.equal(result.hasContradictions, false);
});

test('returns no warning when memory is consistent', () => {
  const result = detectMemoryContradictions([
    memory('a', 'identity', 'My name is Atlas.'),
    memory('b', 'preference', 'I prefer simple domain.'),
  ]);

  assert.equal(result.hasContradictions, false);
  assert.equal(buildContradictionInstruction(result), '');
});

test('builds bounded contradiction instructions', () => {
  const result = detectMemoryContradictions([
    memory('a', 'identity', 'My name is Atlas.'),
    memory('b', 'identity', 'My name is Nova.'),
  ]);
  const instruction = buildContradictionInstruction(result);
  assert.match(instruction, /Memory consistency warning/);
  assert.match(instruction, /do not invent/i);
  assert.match(instruction, /explicit correction memory/i);
});

test('normalizes comparable values deterministically', () => {
  assert.equal(normalizeComparableMemoryValue(' Atlas!! '), 'atlas');
});
