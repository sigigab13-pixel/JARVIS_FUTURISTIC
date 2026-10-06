import test from 'node:test';
import assert from 'node:assert/strict';
import { assessActionUncertainty, buildUncertaintyManagerInstruction } from '../server/uncertainty-manager-core.mjs';

test('requires the smallest clarification when routing says clarification is needed', () => {
  const result = assessActionUncertainty({
    plan: { requestMode: 'prepare', target: 'Prepare a package' },
    route: { needsClarification: true },
  });
  assert.equal(result.status, 'needs_clarification');
  assert.equal(result.clarificationCount, 1);
  assert.equal(result.previewRequired, false);
});

test('requires a preview before consequential execution', () => {
  const result = assessActionUncertainty({
    plan: {
      requestMode: 'execute',
      target: 'Publish the episode',
      dependencies: ['Explicit authorization for consequential external actions'],
    },
    route: { needsClarification: false },
  });
  assert.equal(result.status, 'preview_required');
  assert.equal(result.previewRequired, true);
  assert.equal(result.allowedToExecute, false);
});

test('execution remains blocked until explicit authorization is represented', () => {
  const result = assessActionUncertainty({
    plan: {
      requestMode: 'execute',
      target: 'Publish the episode',
      dependencies: ['Explicit authorization for consequential external actions'],
      authorized: true,
    },
    route: { needsClarification: false },
  });
  assert.equal(result.allowedToExecute, true);
});

test('flags current-sensitive work without evidence', () => {
  const result = assessActionUncertainty({
    plan: { requestMode: 'decide', target: 'Choose a provider' },
    route: { needsClarification: false },
    evidence: { currentSensitive: true, webSourceCount: 0 },
  });
  assert.equal(result.status, 'evidence_limited');
});

test('returns no uncertainty barrier for ordinary answers', () => {
  const result = assessActionUncertainty({
    plan: { requestMode: 'answer', target: 'Explain this' },
    route: { needsClarification: false },
  });
  assert.equal(result.status, 'ready_to_answer');
});

test('builds clarification instruction without authorizing action', () => {
  const instruction = buildUncertaintyManagerInstruction({ needsClarification: true });
  assert.match(instruction, /exactly one concise clarification/i);
  assert.match(instruction, /Do not perform or claim an external action/i);
});

test('builds preview instruction for consequential work', () => {
  const instruction = buildUncertaintyManagerInstruction({ previewRequired: true });
  assert.match(instruction, /concise preview/i);
  assert.match(instruction, /explicit authorization/i);
});
