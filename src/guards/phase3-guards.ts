/**
 * Phase 3 safety guardrails.
 *
 * These flags describe the release boundary. Consequential actions must not
 * be silently upgraded by an individual office.
 */

export const PHASE3_GUARDS = {
  publishAutomatically: false,
  chargeAutomatically: false,
  orderMerchAutomatically: false,
  submitKDP: false,
  requiresApproval: true,
  requiresVerifiedVideo: true,
} as const;

export interface PublishGuardInput {
  verified: boolean;
  approved: boolean;
}

export function canPublish(input: PublishGuardInput): boolean {
  return Boolean(
    PHASE3_GUARDS.requiresApproval
    && PHASE3_GUARDS.requiresVerifiedVideo
    && input.verified
    && input.approved,
  );
}
