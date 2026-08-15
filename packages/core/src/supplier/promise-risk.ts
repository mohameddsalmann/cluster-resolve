import type { PromiseRiskLevel, PromiseRiskMetrics, SupplierOrderObservation } from './types';

// Promise fidelity policy thresholds (basis points)
const PROMISE_HIGH_RISK_THRESHOLD_BPS = 7000;   // < 70% honoured → HIGH
const PROMISE_MEDIUM_RISK_THRESHOLD_BPS = 8500;  // 70–85% → MEDIUM; ≥ 85% → LOW
const PROMISE_MIN_SAMPLE = 5; // minimum observations with a promise to evaluate

/**
 * Calculates promise risk metrics for a set of supplier order observations.
 * A promise is "honoured" when the order was delivered at or before the promised delivery date.
 * Only observations that have both a promisedDeliveryAt and a deliveryCompletionAt are evaluated.
 */
export function calculatePromiseRiskMetrics(
  observations: SupplierOrderObservation[]
): PromiseRiskMetrics {
  const withPromise = observations.filter((obs) => obs.promisedDeliveryAt !== null);
  const promiseGivenCount = withPromise.length;

  if (promiseGivenCount < PROMISE_MIN_SAMPLE) {
    return {
      promiseGivenCount,
      promiseHonouredCount: 0,
      promiseHonouredBps: null,
      promiseRiskLevel: 'INSUFFICIENT_DATA',
    };
  }

  let honoured = 0;
  for (const obs of withPromise) {
    if (obs.deliveryCompletionAt !== null && obs.promisedDeliveryAt !== null) {
      const delivered = Date.parse(obs.deliveryCompletionAt);
      const promised = Date.parse(obs.promisedDeliveryAt);
      if (Number.isFinite(delivered) && Number.isFinite(promised) && delivered <= promised) {
        honoured++;
      }
    }
    // An observation with a promise but no delivery (cancelled/unfulfilled) counts as NOT honoured
  }

  const promiseHonouredBps = Math.round((honoured / promiseGivenCount) * 10_000);
  const promiseRiskLevel: PromiseRiskLevel =
    promiseHonouredBps < PROMISE_HIGH_RISK_THRESHOLD_BPS
      ? 'HIGH'
      : promiseHonouredBps < PROMISE_MEDIUM_RISK_THRESHOLD_BPS
        ? 'MEDIUM'
        : 'LOW';

  return {
    promiseGivenCount,
    promiseHonouredCount: honoured,
    promiseHonouredBps,
    promiseRiskLevel,
  };
}
