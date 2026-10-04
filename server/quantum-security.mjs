/**
 * JARVIS Future-Ready Cryptography foundation.
 *
 * This module intentionally does NOT implement custom cryptography.
 * It provides a crypto-agility/readiness layer so JARVIS can track
 * standardized post-quantum algorithms and provider support safely.
 */

export const PQC_STANDARDS = Object.freeze([
  {
    id: 'ml-kem',
    name: 'ML-KEM',
    purpose: 'Key establishment / encapsulation',
    status: 'standardized',
  },
  {
    id: 'ml-dsa',
    name: 'ML-DSA',
    purpose: 'Digital signatures',
    status: 'standardized',
  },
  {
    id: 'slh-dsa',
    name: 'SLH-DSA',
    purpose: 'Hash-based digital signatures',
    status: 'standardized',
  },
]);

export const CRYPTO_AGILITY_MODES = Object.freeze([
  'readiness',
  'provider-hybrid',
]);

export function getQuantumSecurityPosture(env = process.env) {
  const requestedMode = String(env.JARVIS_PQC_MODE || 'readiness').trim().toLowerCase();
  const mode = CRYPTO_AGILITY_MODES.includes(requestedMode) ? requestedMode : 'readiness';

  return {
    module: 'quantum-security',
    mode,
    ready: true,
    customCryptography: false,
    providerManagedTransport: true,
    hybridTransportRequiresProviderSupport: true,
    standards: PQC_STANDARDS,
    migrationPolicy: [
      'Inventory cryptographic dependencies before changing algorithms.',
      'Prefer standardized algorithms over custom cryptography.',
      'Use hybrid classical + post-quantum mechanisms only when the platform/provider supports them.',
      'Fail closed when an explicitly requested algorithm is unavailable.',
      'Keep private keys, tokens, and secrets server-side.',
    ],
    limitations: [
      'This module reports application readiness; it does not prove every external provider is post-quantum enabled.',
      'A quantum-ready architecture is not a guarantee that JARVIS can never be compromised.',
    ],
  };
}

export function getCryptoInventory() {
  return {
    runtime: process.versions?.node || 'unknown',
    providerTransport: 'platform-managed TLS',
    applicationAlgorithms: {
      keyDerivation: 'provider/application configuration',
      signatures: 'provider/application configuration',
      keyExchange: 'provider/application configuration',
    },
    pqc: PQC_STANDARDS.map(item => ({
      id: item.id,
      status: 'tracked',
      applicationImplementation: 'not_custom_implemented',
    })),
  };
}
