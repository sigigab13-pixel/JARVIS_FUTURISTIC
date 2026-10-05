/**
 * Canonical Phase 3 contract.
 *
 * This module contains shared identifiers only. It owns no orchestration logic,
 * persistence, network calls, or business rules.
 */

export const PHASE3_VERSION = 'phase3-v1';

export const PHASE3_ID_FIELDS = Object.freeze({
  strategyId: 'strategyId',
  contentId: 'contentId',
  assetId: 'assetId',
  providerId: 'providerId',
  publishId: 'publishId',
});

export const PHASE3_STAGES = Object.freeze([
  'discover',
  'strategy',
  'production',
  'monetization',
  'publish',
  'measure',
]);

export const PHASE3_DOCUMENT_KEYS = Object.freeze({
  strategy: 'strategy',
  content: 'content',
  asset: 'asset',
  publication: 'publication',
});
