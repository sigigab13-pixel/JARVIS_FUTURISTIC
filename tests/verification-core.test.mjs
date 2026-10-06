import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVerificationResult,
  isVerified,
  verifyMissionOutcome,
  verifyToolResult,
} from '../server/verification-core.mjs';

test('verification confirms successful tool result only when evidence exists', () => {
  const result = verifyToolResult(
    {
      success: true,
      metadata: { evidence: { provider: 'test', id: 'abc123' } },
    },
    [{ name: 'provider_confirmed', passed: true }],
  );

  assert.equal(result.status, 'confirmed');
  assert.equal(result.verified, true);
  assert.equal(isVerified(result), true);
});

test('verification refuses to trust success without evidence', () => {
  const result = verifyToolResult({ success: true });

  assert.equal(result.status, 'not_verified');
  assert.equal(result.verified, false);
  assert.equal(isVerified(result), false);
});

test('verification fails when execution failed', () => {
  const result = verifyToolResult({
    success: false,
    error: { message: 'Provider timeout' },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.verified, false);
  assert.match(result.message, /Provider timeout/);
});

test('verification fails when an explicit check fails', () => {
  const result = verifyToolResult(
    {
      success: true,
      metadata: { evidence: { provider: 'test', id: 'abc123' } },
    },
    [
      { name: 'provider_confirmed', passed: true },
      { name: 'asset_exists', passed: false },
    ],
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.verified, false);
  assert.match(result.message, /asset_exists/);
});

test('mission cannot be verified from terminal status alone', () => {
  const result = verifyMissionOutcome({ status: 'succeeded' });

  assert.equal(result.status, 'not_verified');
  assert.equal(result.verified, false);
});

test('mission is verified only with terminal success and evidence', () => {
  const result = verifyMissionOutcome({
    status: 'succeeded',
    lastEvidence: {
      provider: 'test',
      assetId: 'video-001',
      confirmedAt: '2026-10-06T00:00:00.000Z',
    },
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.verified, true);
  assert.equal(isVerified(result), true);
});

test('failed mission cannot be verified even if evidence is present', () => {
  const result = verifyMissionOutcome({
    status: 'failed',
    lastEvidence: { provider: 'test', assetId: 'video-001' },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.verified, false);
});

test('unknown verification status is normalized safely', () => {
  const result = createVerificationResult({
    status: 'made_up_status',
    evidence: { id: 'x' },
  });

  assert.equal(result.status, 'not_verified');
  assert.equal(result.verified, false);
});
