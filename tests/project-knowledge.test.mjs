import test from 'node:test';
import assert from 'node:assert/strict';
import { VANTORA_KNOWLEDGE, TJR_VERIFICATION_KNOWLEDGE, projectKnowledgeContext } from '../server/project-knowledge.mjs';

test('Vantora knowledge contains the locked Phase 1 facts', () => {
  assert.equal(VANTORA_KNOWLEDGE.budgetUsd, 25500);
  assert.equal(VANTORA_KNOWLEDGE.timelineWeeks, 20);
  assert.ok(VANTORA_KNOWLEDGE.phase1Mvp.includes('Wallet'));
  assert.ok(VANTORA_KNOWLEDGE.phase1Mvp.includes('Logistics via Kwik API'));
  assert.ok(VANTORA_KNOWLEDGE.stack.includes('Flutter'));
  assert.ok(VANTORA_KNOWLEDGE.stack.includes('NestJS'));
  assert.ok(VANTORA_KNOWLEDGE.stack.includes('Amadeus / Duffel'));
  assert.ok(VANTORA_KNOWLEDGE.forbiddenConfusions.some(item => /crypto/i.test(item)));
});

test('TJR verification knowledge contains official handles and impersonation pattern', () => {
  assert.deepEqual(TJR_VERIFICATION_KNOWLEDGE.trustedHandles, ['@tjr_tradez', '@tjrtrades']);
  assert.equal(TJR_VERIFICATION_KNOWLEDGE.knownTestHandle, '@..tjrtradez');
  assert.ok(TJR_VERIFICATION_KNOWLEDGE.knownImpersonationPattern.test('@..tjrtradez'));
});

test('project knowledge context is deterministic and specific', () => {
  const context = projectKnowledgeContext();
  assert.match(context, /Vantora Phase 1 MVP/);
  assert.match(context, /20 weeks/);
  assert.match(context, /15-minute retry window/);
  assert.match(context, /@tjr_tradez/);
  assert.match(context, /@\.\.tjrtradez/);
});
