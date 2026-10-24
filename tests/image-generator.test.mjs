import test from 'node:test';
import assert from 'node:assert/strict';
import { getImageLabStatus } from '../server/image-generator.mjs';

test('Image Lab diagnostics distinguish missing provider credentials', () => {
  assert.equal(getImageLabStatus({ tokenConfigured: false, tokenValid: false }), 'not_configured');
});

test('Image Lab diagnostics distinguish invalid provider credentials', () => {
  assert.equal(getImageLabStatus({ tokenConfigured: true, tokenValid: false }), 'misconfigured');
});

test('Image Lab is ready only when provider credentials are verified', () => {
  assert.equal(getImageLabStatus({ tokenConfigured: true, tokenValid: true }), 'ready');
});
