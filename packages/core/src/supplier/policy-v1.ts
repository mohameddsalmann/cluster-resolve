export const PHASE4_ENGINE_VERSION = 'phase4-v1' as const;

export const SUPPLIER_RELIABILITY_POLICY_V1 = {
  recentWindowDays: 14,
  baselineWindowDays: 28,
  minimumRecentOrders: 10,
  minimumBaselineOrders: 20,
  triggers: {
    fillRateDropBps: 1_000,
    otifDropBps: 1_000,
    cancellationIncreaseBps: 500,
    partialFillIncreaseBps: 1_000,
    leadTimeP95MinimumIncreaseMinutes: 120,
  },
  severe: {
    fillRateDropBps: 2_000,
    otifDropBps: 2_000,
    cancellationIncreaseBps: 1_000,
  },
} as const;
