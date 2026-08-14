import { calculateReliabilityMetrics } from './metrics';
import { SUPPLIER_RELIABILITY_POLICY_V1 } from './policy-v1';
import type {
  DeteriorationTrigger,
  DeteriorationTriggerCode,
  SupplierOrderObservation,
  SupplierReliabilityEvaluation,
} from './types';

const DAY_MS = 86_400_000;

export function evaluateSupplierReliability(
  datasetId: string,
  supplierId: string,
  observations: SupplierOrderObservation[],
  asOf: string
): SupplierReliabilityEvaluation {
  const asOfTime = timestamp(asOf);
  const recentStart = asOfTime - SUPPLIER_RELIABILITY_POLICY_V1.recentWindowDays * DAY_MS;
  const baselineStart = recentStart - SUPPLIER_RELIABILITY_POLICY_V1.baselineWindowDays * DAY_MS;
  const supplier = observations.filter((value) => value.datasetId === datasetId && value.supplierId === supplierId);
  const recent = supplier.filter((value) => {
    const placed = timestamp(value.placedAt);
    return placed >= recentStart && placed <= asOfTime;
  });
  const baseline = supplier.filter((value) => {
    const placed = timestamp(value.placedAt);
    return placed >= baselineStart && placed < recentStart;
  });
  const recentMetrics = calculateReliabilityMetrics(recent);
  const baselineMetrics = calculateReliabilityMetrics(baseline);
  const enoughData =
    recent.length >= SUPPLIER_RELIABILITY_POLICY_V1.minimumRecentOrders &&
    baseline.length >= SUPPLIER_RELIABILITY_POLICY_V1.minimumBaselineOrders;
  const triggers = enoughData ? detectTriggers(recentMetrics, baselineMetrics, recent.length) : [];
  const status = !enoughData
    ? 'INSUFFICIENT_DATA' as const
    : triggers.length === 0
      ? 'HEALTHY' as const
      : triggers.some((trigger) => trigger.severe) || triggers.length >= 2
        ? 'HIGH' as const
        : 'WATCH' as const;
  return {
    datasetId,
    supplierId,
    asOf,
    recentWindowDays: SUPPLIER_RELIABILITY_POLICY_V1.recentWindowDays,
    baselineWindowDays: SUPPLIER_RELIABILITY_POLICY_V1.baselineWindowDays,
    recent: recentMetrics,
    baseline: baselineMetrics,
    status,
    triggers,
    recentOrderIds: recent.map((value) => value.orderId).sort(),
    baselineOrderIds: baseline.map((value) => value.orderId).sort(),
  };
}

function detectTriggers(
  recent: ReturnType<typeof calculateReliabilityMetrics>,
  baseline: ReturnType<typeof calculateReliabilityMetrics>,
  evaluatedOrderCount: number
): DeteriorationTrigger[] {
  const triggers: DeteriorationTrigger[] = [];
  addDecrease(
    triggers,
    'FILL_RATE_DROP',
    recent.fillRateBps,
    baseline.fillRateBps,
    SUPPLIER_RELIABILITY_POLICY_V1.triggers.fillRateDropBps,
    SUPPLIER_RELIABILITY_POLICY_V1.severe.fillRateDropBps,
    evaluatedOrderCount
  );
  addDecrease(
    triggers,
    'OTIF_DROP',
    recent.otifRateBps,
    baseline.otifRateBps,
    SUPPLIER_RELIABILITY_POLICY_V1.triggers.otifDropBps,
    SUPPLIER_RELIABILITY_POLICY_V1.severe.otifDropBps,
    evaluatedOrderCount
  );
  addIncrease(
    triggers,
    'CANCELLATION_INCREASE',
    recent.cancellationRateBps,
    baseline.cancellationRateBps,
    SUPPLIER_RELIABILITY_POLICY_V1.triggers.cancellationIncreaseBps,
    SUPPLIER_RELIABILITY_POLICY_V1.severe.cancellationIncreaseBps,
    evaluatedOrderCount
  );
  addIncrease(
    triggers,
    'PARTIAL_FILL_INCREASE',
    recent.partialFillRateBps,
    baseline.partialFillRateBps,
    SUPPLIER_RELIABILITY_POLICY_V1.triggers.partialFillIncreaseBps,
    null,
    evaluatedOrderCount
  );
  if (recent.leadTimeP95Minutes !== null && baseline.leadTimeP95Minutes !== null) {
    const delta = recent.leadTimeP95Minutes - baseline.leadTimeP95Minutes;
    if (
      recent.leadTimeP95Minutes * 2 >= baseline.leadTimeP95Minutes * 3 &&
      delta >= SUPPLIER_RELIABILITY_POLICY_V1.triggers.leadTimeP95MinimumIncreaseMinutes
    ) {
      triggers.push({
        code: 'LEAD_TIME_P95_DETERIORATION',
        recent: recent.leadTimeP95Minutes,
        baseline: baseline.leadTimeP95Minutes,
        delta,
        threshold: SUPPLIER_RELIABILITY_POLICY_V1.triggers.leadTimeP95MinimumIncreaseMinutes,
        severe: false,
        evaluatedOrderCount,
      });
    }
  }
  return triggers;
}

function addDecrease(
  triggers: DeteriorationTrigger[],
  code: DeteriorationTriggerCode,
  recent: number | null,
  baseline: number | null,
  threshold: number,
  severeThreshold: number | null,
  evaluatedOrderCount: number
): void {
  if (recent === null || baseline === null) return;
  const delta = baseline - recent;
  if (delta < threshold) return;
  triggers.push({
    code,
    recent,
    baseline,
    delta,
    threshold,
    severe: severeThreshold !== null && delta >= severeThreshold,
    evaluatedOrderCount,
  });
}

function addIncrease(
  triggers: DeteriorationTrigger[],
  code: DeteriorationTriggerCode,
  recent: number | null,
  baseline: number | null,
  threshold: number,
  severeThreshold: number | null,
  evaluatedOrderCount: number
): void {
  if (recent === null || baseline === null) return;
  const delta = recent - baseline;
  if (delta < threshold) return;
  triggers.push({
    code,
    recent,
    baseline,
    delta,
    threshold,
    severe: severeThreshold !== null && delta >= severeThreshold,
    evaluatedOrderCount,
  });
}

function timestamp(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid evaluation timestamp: ${value}`);
  return result;
}
