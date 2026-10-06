import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRepairInstruction,
  inspectAssistantResponse,
  repairTextDeterministically,
  selfCheckAndNormalize,
} from '../server/self-check-core.mjs';

test('accepts a normal assistant response', () => {
  const result = inspectAssistantResponse('Here is the answer you asked for.', {
    request: 'Give me the answer.',
    provider: 'OpenAI',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test('detects the object serialization leak', () => {
  const result = inspectAssistantResponse('The backend returned [object Object].');
  assert.equal(result.ok, false);
  assert.equal(result.repairable, true);
  assert.equal(result.issues[0].code, 'OBJECT_SERIALIZATION_LEAK');
});

test('detects unresolved values and unclosed code fences', () => {
  const result = inspectAssistantResponse('Result: undefined\n```js\nconsole.log("x");');
  assert.equal(result.ok, false);
  assert.equal(result.issues.some(item => item.code === 'UNRESOLVED_VALUE_LEAK'), true);
  assert.equal(result.issues.some(item => item.code === 'UNCLOSED_CODE_FENCE'), true);
});

test('detects repeated substantive lines', () => {
  const line = 'This is a repeated substantive line that should be caught.';
  const result = inspectAssistantResponse([line, line, line].join('\n'));
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, 'REPEATED_BLOCK');
});

test('does not auto-repair an empty response', () => {
  const result = inspectAssistantResponse('');
  assert.equal(result.ok, false);
  assert.equal(result.repairable, false);
});

test('deterministic normalization only normalizes safe formatting', () => {
  const result = selfCheckAndNormalize('  Hello [object Object]  ');
  assert.equal(result.repaired, true);
  assert.equal(result.text, 'Hello [object Object]');
  assert.equal(result.after.ok, false);
  assert.equal(result.after.issues[0].code, 'OBJECT_SERIALIZATION_LEAK');
});

test('repair instruction is bounded and user-facing', () => {
  const check = inspectAssistantResponse('[object Object]');
  const instruction = buildRepairInstruction(check);

  assert.match(instruction, /JARVIS SELF-CHECK REPAIR/);
  assert.match(instruction, /OBJECT_SERIALIZATION_LEAK/);
  assert.match(instruction, /Return only the corrected answer/);
  assert.doesNotMatch(instruction, /chain[- ]of[- ]thought/i);
});

test('deterministic repair helper is idempotent', () => {
  const once = repairTextDeterministically('Hello [object Object]');
  const twice = repairTextDeterministically(once);
  assert.equal(once, twice);
});