import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDecisionMemory,
  isDecisionMemory,
  normalizeDecisionRecord,
  parseExplicitDecision,
} from '../server/decision-memory.mjs';

test('parses an explicit decision with its rationale', () => {
  const record = parseExplicitDecision(
    'We decided to keep Vercel deployments batched because repeated deploys waste quota.'
  );

  assert.equal(record?.decision, 'We decided to keep Vercel deployments batched');
  assert.equal(record?.rationale, 'repeated deploys waste quota.');
  assert.equal(record?.rejected, null);
  assert.equal(isDecisionMemory(record), true);
});

test('captures a rejected alternative', () => {
  const record = parseExplicitDecision(
    'From now on use the canonical Vercel project instead of duplicate projects because we need one source of truth.'
  );

  assert.equal(record?.rejected, 'duplicate projects');
  assert.equal(record?.rationale, 'we need one source of truth.');
});

test('returns null for ordinary conversation', () => {
  assert.equal(parseExplicitDecision('Tell me a story about Kobi.'), null);
});

test('normalizes bounded decision fields', () => {
  const record = normalizeDecisionRecord({
    decision: '  We will test before release.  ',
    rationale: '  To avoid false success. ',
    rejected: ' guessing',
    scope: ' release-governance ',
    source: ' chat ',
  });

  assert.deepEqual(record, {
    decision: 'We will test before release.',
    rationale: 'To avoid false success.',
    rejected: 'guessing',
    scope: 'release-governance',
    status: 'active',
    source: 'chat',
  });
});

test('formats decision memory so the model can see decision and why', () => {
  const formatted = formatDecisionMemory({
    decision: 'Use one canonical project',
    rationale: 'to avoid split sources of truth',
    rejected: 'duplicate projects',
  });

  assert.match(formatted, /\[JARVIS DECISION MEMORY\]/);
  assert.match(formatted, /Decision: Use one canonical project/);
  assert.match(formatted, /Why: to avoid split sources of truth/);
  assert.match(formatted, /Rejected alternative: duplicate projects/);
});
