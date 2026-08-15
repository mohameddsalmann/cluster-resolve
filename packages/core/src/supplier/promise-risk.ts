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
const MINIMUM_EVALUATED_ORDERS_FOR_OFFER_RISK = 5;

/**
 * Evaluates the risk of a CURRENT recorded supplier offer against recent historical fulfillment evidence.
 * Product-specific evidence takes precedence when it meets the minimum evaluated sample threshold.
 * Otherwise, supplier-level evidence is used as fallback.
 * If neither meets the sample threshold, returns INSUFFICIENT_DATA.
 *
 * Deterministic triggers evaluated:
 * 1. LEAD_TIME_BELOW_P95: Promised lead time is significantly faster than historical P95 (CRITICAL).
 * 2. LEAD_TIME_BELOW_P50: Promised lead time is noticeably faster than historical median P50 (WARN).
 * 3. POOR_FILL_RATE_HISTORY: Historical fill rate is poor (<75% WARN, <60% CRITICAL).
 * 4. ELEVATED_CANCELLATIONS: Historical cancellation rate is elevated (>10% WARN, >20% CRITICAL).
 * 5. FREQUENT_PARTIAL_FILLS: Historical partial fill rate is elevated (>20% WARN).
 */
export function evaluateCurrentOfferPromiseRisk(
  input: import('./types').CurrentOfferPromiseRiskInput
): import('./types').CurrentOfferPromiseRiskEvidence {
  // Determine evidence source: product-level preferred if sample count >= 5
  let evidence: import('./types').ReliabilityMetrics | null = null;
  let evidenceSource: 'PRODUCT' | 'SUPPLIER' | 'NONE' = 'NONE';

  if (
    input.productMetrics &&
    input.productMetrics.evaluatedOrders >= MINIMUM_EVALUATED_ORDERS_FOR_OFFER_RISK
  ) {
    evidence = input.productMetrics;
    evidenceSource = 'PRODUCT';
  } else if (
    input.supplierMetrics &&
    input.supplierMetrics.evaluatedOrders >= MINIMUM_EVALUATED_ORDERS_FOR_OFFER_RISK
  ) {
    evidence = input.supplierMetrics;
    evidenceSource = 'SUPPLIER';
  }

  // Calculate promised lead time in minutes
  let promisedLeadTimeMinutes: number | null = null;
  if (input.promisedDeliveryAt && input.orderPlacedAt) {
    const promisedMs = Date.parse(input.promisedDeliveryAt);
    const placedMs = Date.parse(input.orderPlacedAt);
    if (Number.isFinite(promisedMs) && Number.isFinite(placedMs)) {
      const diffMin = Math.round((promisedMs - placedMs) / 60_000);
      promisedLeadTimeMinutes = diffMin >= 0 ? diffMin : null;
    }
  }

  const currentOfferSummary = {
    requestedQty: input.requestedQty,
    availableQty: input.availableQty,
    promisedDeliveryAt: input.promisedDeliveryAt,
    orderPlacedAt: input.orderPlacedAt,
    promisedLeadTimeMinutes,
  };

  if (!evidence || evidenceSource === 'NONE') {
    return {
      level: 'INSUFFICIENT_DATA',
      evidenceSource: 'NONE',
      currentOffer: currentOfferSummary,
      historicalEvidence: {
        evaluatedOrders: input.productMetrics?.evaluatedOrders ?? input.supplierMetrics?.evaluatedOrders ?? 0,
        fillRateBps: null,
        otifRateBps: null,
        cancellationRateBps: null,
        partialFillRateBps: null,
        leadTimeP50Minutes: null,
        leadTimeP95Minutes: null,
      },
      triggers: [],
      summary: 'Insufficient historical fulfillment observations (minimum 5 orders required) to evaluate promise risk.',
    };
  }

  const triggers: import('./types').CurrentOfferPromiseRiskTrigger[] = [];

  // Trigger 1 & 2: Lead time comparison
  if (promisedLeadTimeMinutes !== null) {
    if (
      evidence.leadTimeP95Minutes !== null &&
      promisedLeadTimeMinutes < 0.6 * evidence.leadTimeP95Minutes &&
      evidence.leadTimeP95Minutes - promisedLeadTimeMinutes >= 120
    ) {
      const promisedHours = (promisedLeadTimeMinutes / 60).toFixed(1);
      const p95Hours = (evidence.leadTimeP95Minutes / 60).toFixed(1);
      triggers.push({
        code: 'LEAD_TIME_BELOW_P95',
        severity: 'CRITICAL',
        message: `Promised delivery in ${promisedHours}h is materially below historical P95 lead time (${p95Hours}h). Risk of late delivery is elevated.`,
        evidenceKey: 'leadTimeP95Minutes',
      });
    } else if (
      evidence.leadTimeP50Minutes !== null &&
      promisedLeadTimeMinutes < 0.7 * evidence.leadTimeP50Minutes &&
      evidence.leadTimeP50Minutes - promisedLeadTimeMinutes >= 60
    ) {
      const promisedHours = (promisedLeadTimeMinutes / 60).toFixed(1);
      const p50Hours = (evidence.leadTimeP50Minutes / 60).toFixed(1);
      triggers.push({
        code: 'LEAD_TIME_BELOW_P50',
        severity: 'WARN',
        message: `Promised delivery in ${promisedHours}h is noticeably below historical median lead time (${p50Hours}h).`,
        evidenceKey: 'leadTimeP50Minutes',
      });
    }
  }

  // Trigger 3: Fill rate history
  if (evidence.fillRateBps !== null) {
    if (evidence.fillRateBps < 6000) {
      triggers.push({
        code: 'POOR_FILL_RATE_HISTORY',
        severity: 'CRITICAL',
        message: `Historical fill rate is severely depressed at ${(evidence.fillRateBps / 100).toFixed(1)}%. Available stock commitment may be unfulfilled.`,
        evidenceKey: 'fillRateBps',
      });
    } else if (evidence.fillRateBps < 7500) {
      triggers.push({
        code: 'POOR_FILL_RATE_HISTORY',
        severity: 'WARN',
        message: `Historical fill rate is below benchmark at ${(evidence.fillRateBps / 100).toFixed(1)}%.`,
        evidenceKey: 'fillRateBps',
      });
    }
  }

  // Trigger 4: Cancellations
  if (evidence.cancellationRateBps !== null) {
    if (evidence.cancellationRateBps > 2000) {
      triggers.push({
        code: 'ELEVATED_CANCELLATIONS',
        severity: 'CRITICAL',
        message: `Historical cancellation rate is high at ${(evidence.cancellationRateBps / 100).toFixed(1)}%.`,
        evidenceKey: 'cancellationRateBps',
      });
    } else if (evidence.cancellationRateBps > 1000) {
      triggers.push({
        code: 'ELEVATED_CANCELLATIONS',
        severity: 'WARN',
        message: `Historical cancellation rate is elevated at ${(evidence.cancellationRateBps / 100).toFixed(1)}%.`,
        evidenceKey: 'cancellationRateBps',
      });
    }
  }

  // Trigger 5: Partial fills
  if (evidence.partialFillRateBps !== null && evidence.partialFillRateBps > 2000) {
    triggers.push({
      code: 'FREQUENT_PARTIAL_FILLS',
      severity: 'WARN',
      message: `Historical partial fill rate is ${(evidence.partialFillRateBps / 100).toFixed(1)}%. Supplier frequently short-ships orders.`,
      evidenceKey: 'partialFillRateBps',
    });
  }

  // Classification:
  // HIGH: any CRITICAL trigger, or >= 2 WARN triggers
  // WATCH: exactly 1 WARN trigger
  // LOW: 0 triggers
  const hasCritical = triggers.some((t) => t.severity === 'CRITICAL');
  const warnCount = triggers.filter((t) => t.severity === 'WARN').length;

  let level: import('./types').CurrentOfferPromiseRiskState = 'LOW';
  if (hasCritical || warnCount >= 2) {
    level = 'HIGH';
  } else if (warnCount === 1) {
    level = 'WATCH';
  }

  const summary =
    level === 'HIGH'
      ? `High promise risk: ${triggers.map((t) => t.message).join(' ')}`
      : level === 'WATCH'
        ? `Watch promise risk: ${triggers.map((t) => t.message).join(' ')}`
        : `Low promise risk: Offer aligns with historical fulfillment performance across ${evidence.evaluatedOrders} evaluated orders (${evidenceSource.toLowerCase()} evidence).`;

  return {
    level,
    evidenceSource,
    currentOffer: currentOfferSummary,
    historicalEvidence: {
      evaluatedOrders: evidence.evaluatedOrders,
      fillRateBps: evidence.fillRateBps,
      otifRateBps: evidence.otifRateBps,
      cancellationRateBps: evidence.cancellationRateBps,
      partialFillRateBps: evidence.partialFillRateBps,
      leadTimeP50Minutes: evidence.leadTimeP50Minutes,
      leadTimeP95Minutes: evidence.leadTimeP95Minutes,
    },
    triggers,
    summary,
  };
}
