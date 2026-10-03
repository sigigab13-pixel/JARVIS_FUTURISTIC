import test from 'node:test';
import assert from 'node:assert/strict';
import { getCapabilityRegistry, rankCapabilitiesForIntent } from '../server/capabilities.mjs';

test('capability registry returns stable ids and availability flags', () => {
  const registry = getCapabilityRegistry();
  assert.ok(registry.length >= 8);
  for (const capability of registry) {
    assert.equal(typeof capability.id, 'string');
    assert.equal(typeof capability.label, 'string');
    assert.equal(typeof capability.available, 'boolean');
  }
});

test('capability ranking identifies likely tools from natural language', () => {
  const ranked = rankCapabilitiesForIntent('please create a picture for my business and publish it on youtube');
  const ids = ranked.map(item => item.id);
  assert.ok(ids.includes('image'));
  assert.ok(ids.includes('business'));
  assert.ok(ids.includes('youtube'));
});
