/**
 * Canonical Phase 3 contracts.
 *
 * Types only. This file owns the shared identity vocabulary used by the
 * Phase 3 offices. It contains no network, persistence, or orchestration code.
 */

export type Phase3Id = string;

export interface ContentIdentity {
  strategyId: Phase3Id;
  trendId?: Phase3Id;
  contentId: Phase3Id;
  assetId?: Phase3Id;
  providerId?: Phase3Id;
  publishId?: Phase3Id;
}

export type ContentSeries = 'kids' | 'bible' | 'history' | 'life' | 'military';
export type ContentPlatform = 'youtube' | 'tiktok' | 'facebook';
export type ContentFormat = '9:16' | '16:9' | '1:1';
export type ContentAgeBand = '0-3' | '4-7' | '8-12' | '13+';
export type EntitlementPlan = 'free' | 'pro' | 'premium';

export interface StrategyOutput extends ContentIdentity {
  seriesId: ContentSeries;
  topic: string;
  targetAge: ContentAgeBand;
  platforms: ContentPlatform[];
  format: ContentFormat;
  titleVariants: [string, string];
  thumbnailConcepts: [string, string];
  safetyRequiresApproval: true;
  planningScore: number;
}

export const PHASE3_STAGES = [
  'discover',
  'plan',
  'produce',
  'monetize',
  'publish',
  'measure',
] as const;

export type Phase3Stage = typeof PHASE3_STAGES[number];
