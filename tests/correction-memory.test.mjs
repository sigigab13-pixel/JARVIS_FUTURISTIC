import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseUserCorrection,
  formatCorrectionMemory,
  isExplicitCorrection,
} from '../server/correction-memory.mjs';

test('parses an explicit name correction', () => {
  const correction = parseUserCorrection("My name is not Victory, it's Saviour.");
  assert.equal(correction.scope, 'identity');
  assert.equal(correction.field, 'name');
  assert.equal(correction.previous, 'Victory');
  assert.equal(correction.current, 'Saviour');
  assert.match(correction.statement, /Saviour/);
});

test('parses direct name correction wording', () => {
  const correction = parseUserCorrection('My name is Atlas, not Nova.');
  assert.equal(correction.scope, 'identity');
  assert.equal(correction.field, 'name');
  assert.equal(correction.previous, 'Nova');
  assert.equal(correction.current, 'Atlas');
});

test('parses a do-not-call-me correction', () => {
  const correction = parseUserCorrection("Don't call me Victory, call me Saviour.");
  assert.equal(correction.previous, 'Victory');
  assert.equal(correction.current, 'Saviour');
});

test('parses an intended-value correction', () => {
  const correction = parseUserCorrection('I said the old domain, but I meant the simple domain.');
  assert.equal(correction.previous, 'the old domain');
  assert.equal(correction.current, 'the simple domain');
});

test('parses a labeled correction without inventing a previous value', () => {
  const correction = parseUserCorrection('Correction: Use the simple JARVIS domain.');
  assert.equal(correction.previous, null);
  assert.equal(correction.current, 'Use the simple JARVIS domain.');
  assert.equal(correction.scope, 'general');
});

test('parses concise two-value correction form', () => {
  const correction = parseUserCorrection('Saviour not Victory');
  assert.equal(correction.previous, 'Victory');
  assert.equal(correction.current, 'Saviour');
});

test('does not misclassify ordinary negative statements', () => {
  assert.equal(parseUserCorrection('I am not hungry.'), null);
  assert.equal(parseUserCorrection('This is not working.'), null);
  assert.equal(parseUserCorrection('We are not using the old plan.'), null);
});

test('formats stable durable correction memory', () => {
  const correction = parseUserCorrection("My name is not Victory, it's Saviour.");
  const memory = formatCorrectionMemory(correction);
  assert.match(memory, /^\[JARVIS CORRECTION MEMORY\]/);
  assert.match(memory, /Status: active/);
  assert.match(memory, /Superseded value: Victory/);
  assert.match(memory, /Current value: Saviour/);
});

test('validates only explicit correction records', () => {
  assert.equal(isExplicitCorrection(parseUserCorrection('Saviour not Victory')), true);
  assert.equal(isExplicitCorrection({ kind: 'correction', statement: '' }), false);
  assert.equal(isExplicitCorrection(null), false);
});
