/**
 * TypeScript view of the canonical Phase 3 contract.
 *
 * Server-side offices import the runtime-safe .mjs contract. Frontend code can
 * import this file for the same constants plus shared Phase 3 ID types.
 */

export { PHASE3_VERSION, PHASE3_ID_FIELDS, PHASE3_STAGES, PHASE3_DOCUMENT_KEYS } from './phase3-contracts.mjs';

export interface Phase3IdChain {
  strategyId: string;
  contentId: string;
  assetId: string;
  providerId?: string | null;
  publishId?: string | null;
}
