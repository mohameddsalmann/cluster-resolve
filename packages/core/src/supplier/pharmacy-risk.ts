import type { PharmacyServiceRisk, PharmacyServiceRiskLevel } from './types';

// Policy thresholds for pharmacy service risk classification
const HIGH_RISK_EXCEPTION_RATE_BPS = 5000;   // ≥ 50% orders with exceptions → HIGH_RISK
const HIGH_RISK_MIN_HIGH_EXCEPTIONS = 2;      // OR ≥ 2 HIGH-severity exceptions → HIGH_RISK
const AT_RISK_EXCEPTION_RATE_BPS = 2000;      // ≥ 20% orders with exceptions → AT_RISK

interface PharmacyOrderInput {
  orderId: string;
}

interface PharmacyExceptionInput {
  orderId: string;
  type: string;
  severity: string;
}

/**
 * Evaluates pharmacy service risk from exception history.
 * Pure computation — no DB access.
 */
export function evaluatePharmacyServiceRisk(
  pharmacyId: string,
  orders: PharmacyOrderInput[],
  exceptions: PharmacyExceptionInput[]
): PharmacyServiceRisk {
  const totalOrders = orders.length;
  const orderIds = new Set(orders.map((o) => o.orderId));

  // Only count exceptions that belong to this pharmacy's orders
  const pharmacyExceptions = exceptions.filter((exc) => orderIds.has(exc.orderId));

  const orderIdsWithExceptions = new Set(pharmacyExceptions.map((exc) => exc.orderId));
  const ordersWithExceptions = orderIdsWithExceptions.size;

  const cancellationAffected = new Set(
    pharmacyExceptions.filter((exc) => exc.type === 'CANCELLED').map((exc) => exc.orderId)
  ).size;
  const partialFillAffected = new Set(
    pharmacyExceptions.filter((exc) => exc.type === 'PARTIAL_FILL').map((exc) => exc.orderId)
  ).size;
  const lateDeliveryAffected = new Set(
    pharmacyExceptions.filter((exc) => exc.type === 'LATE_DELIVERY').map((exc) => exc.orderId)
  ).size;
  const highSeverityExceptions = pharmacyExceptions.filter((exc) => exc.severity === 'HIGH').length;

  const exceptionRateBps =
    totalOrders > 0
      ? Math.round((ordersWithExceptions / totalOrders) * 10_000)
      : null;

  let serviceRiskLevel: PharmacyServiceRiskLevel = 'INSUFFICIENT_DATA';
  if (totalOrders > 0) {
    serviceRiskLevel = 'STABLE';
    if (
      (exceptionRateBps !== null && exceptionRateBps >= HIGH_RISK_EXCEPTION_RATE_BPS) ||
      highSeverityExceptions >= HIGH_RISK_MIN_HIGH_EXCEPTIONS
    ) {
      serviceRiskLevel = 'HIGH_RISK';
    } else if (exceptionRateBps !== null && exceptionRateBps >= AT_RISK_EXCEPTION_RATE_BPS) {
      serviceRiskLevel = 'AT_RISK';
    }
  }

  return {
    pharmacyId,
    totalOrders,
    evaluatedOrders: totalOrders,
    ordersWithExceptions,
    exceptionRateBps,
    cancellationAffected,
    partialFillAffected,
    lateDeliveryAffected,
    highSeverityExceptions,
    serviceRiskLevel,
  };
}
