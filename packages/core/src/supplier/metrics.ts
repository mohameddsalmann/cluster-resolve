import { nearestRankPercentile } from './percentiles';
import type { ReliabilityMetrics, SupplierOrderObservation } from './types';

export function calculateReliabilityMetrics(
  observations: SupplierOrderObservation[]
): ReliabilityMetrics {
  const requested = observations.reduce((sum, value) => sum + BigInt(value.requestedUnits), 0n);
  const filled = observations.reduce((sum, value) => sum + BigInt(value.filledUnits), 0n);
  const otifEligible = observations.filter((value) => value.otifEligible);
  const leadTimes = observations
    .map((value) => value.leadTimeMinutes)
    .filter((value): value is number => value !== null);

  return {
    evaluatedOrders: observations.length,
    fillRateBps: requested === 0n ? null : ratioBps(filled, requested),
    otifRateBps:
      otifEligible.length === 0
        ? null
        : ratioBps(BigInt(otifEligible.filter((value) => value.otif).length), BigInt(otifEligible.length)),
    // One supplier/order observation is cancellation-affected when any of its
    // persisted final outcome lines explicitly carries cancelled=true.
    cancellationRateBps:
      observations.length === 0
        ? null
        : ratioBps(BigInt(observations.filter((value) => value.cancellationAffected).length), BigInt(observations.length)),
    partialFillRateBps:
      observations.length === 0
        ? null
        : ratioBps(BigInt(observations.filter((value) => value.partialFill).length), BigInt(observations.length)),
    leadTimeP50Minutes: nearestRankPercentile(leadTimes, 50),
    leadTimeP95Minutes: nearestRankPercentile(leadTimes, 95),
  };
}

export function ratioBps(numerator: bigint, denominator: bigint): number {
  if (numerator < 0n || denominator <= 0n || numerator > denominator) {
    throw new Error('Basis-point ratio inputs are out of range.');
  }
  return Number((numerator * 10_000n) / denominator);
}
