const PLANS = Object.freeze([
  {
    code: 'free',
    name: 'Free',
    currency: 'USD',
    monthlyPrice: 0,
    billingEnabled: false,
    features: {
      basicChat: true,
      contentStrategy: true,
      trendDiscovery: true,
      monetizationTracking: true,
      advancedVideo: false,
      apiAccess: false,
    },
  },
  {
    code: 'creator',
    name: 'Creator',
    currency: 'USD',
    monthlyPrice: 19,
    billingEnabled: false,
    features: {
      basicChat: true,
      contentStrategy: true,
      trendDiscovery: true,
      monetizationTracking: true,
      advancedVideo: true,
      apiAccess: false,
    },
  },
  {
    code: 'studio',
    name: 'Studio',
    currency: 'USD',
    monthlyPrice: 99,
    billingEnabled: false,
    features: {
      basicChat: true,
      contentStrategy: true,
      trendDiscovery: true,
      monetizationTracking: true,
      advancedVideo: true,
      apiAccess: true,
    },
  },
]);

export function getSubscriptionPlans() {
  return PLANS.map(plan => ({
    ...plan,
    features: { ...plan.features },
  }));
}

export function getSubscriptionPlan(code) {
  const normalized = String(code || '').trim().toLowerCase();
  const plan = PLANS.find(candidate => candidate.code === normalized);
  return plan ? { ...plan, features: { ...plan.features } } : null;
}

export function getBillingStatus() {
  return {
    enabled: false,
    provider: null,
    mode: 'catalog-only',
    note: 'These plans describe a proposed JARVIS commercial model. No payment, checkout, subscription, or automatic charging is enabled by this office.',
  };
}
