import test from 'node:test';
import assert from 'node:assert/strict';
import { CRYPTO_AGILITY_MODES, PQC_STANDARDS, getCryptoInventory, getQuantumSecurityPosture } from '../server/quantum-security.mjs';

test('quantum security tracks standardized PQC algorithms without inventing cryptography', () => {
  assert.deepEqual(PQC_STANDARDS.map(item => item.name), ['ML-KEM', 'ML-DSA', 'SLH-DSA']);
  const posture = getQuantumSecurityPosture({ JARVIS_PQC_MODE: 'readiness' });
  assert.equal(posture.ready, true);
  assert.equal(posture.customCryptography, false);
  assert.equal(posture.mode, 'readiness');
});

test('quantum security rejects unsupported modes back to safe readiness mode', () => {
  const posture = getQuantumSecurityPosture({ JARVIS_PQC_MODE: 'experimental' });
  assert.equal(posture.mode, 'readiness');
  assert.deepEqual(CRYPTO_AGILITY_MODES, ['readiness', 'provider-hybrid']);
});

test('crypto inventory is explicit about provider-managed algorithms', () => {
  const inventory = getCryptoInventory();
  assert.equal(inventory.providerTransport, 'platform-managed TLS');
  assert.equal(inventory.pqc.every(item => item.applicationImplementation === 'not_custom_implemented'), true);
});
