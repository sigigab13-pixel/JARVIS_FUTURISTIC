import {
  estimatePlatformRevenue,
  buildYouTubeRevenueSnapshot,
} from './monetization/youtube-revenue-tracker.mjs';
import { buildKdpExport } from './monetization/kdp-exporter.mjs';
import { buildMerchExport } from './monetization/merch-generator.mjs';
import {
  getSubscriptionPlans,
  getSubscriptionPlan,
  getBillingStatus,
} from './monetization/subscription-plans.mjs';

export const MONETIZATION_OFFICE_VERSION = 'v1';
export const MONETIZATION_PLATFORMS = Object.freeze(['youtube', 'tiktok', 'facebook']);

export function getMonetizationOfficeConfig() {
  return {
    office: 'monetization',
    version: MONETIZATION_OFFICE_VERSION,
    platforms: [...MONETIZATION_PLATFORMS],
    layers: [
      'platform-revenue-tracking',
      'ip-export',
      'subscription-catalog',
    ],
    billing: getBillingStatus(),
    autoCharge: false,
    autoPublish: false,
    externalMerchOrder: false,
    externalKdpSubmission: false,
  };
}

export {
  estimatePlatformRevenue,
  buildYouTubeRevenueSnapshot,
  buildKdpExport,
  buildMerchExport,
  getSubscriptionPlans,
  getSubscriptionPlan,
  getBillingStatus,
};
