import type {
  ApplicablePromise,
  EvaluationDiagnostic,
  OperationalDecision,
  OperationalEvaluationInput,
  OperationalOffer,
  OrderException,
} from './types';

export interface ExceptionEvaluationResult {
  exceptions: OrderException[];
  diagnostics: EvaluationDiagnostic[];
}

export function evaluateOrderExceptions(input: OperationalEvaluationInput): ExceptionEvaluationResult {
  const orders = new Map(input.orders.map((order) => [order.id, order]));
  const items = new Map(input.items.map((item) => [lineKey(item.orderId, item.productId), item]));
  const suppliersByLine = finalSuppliersByLine(input);
  const exceptions: OrderException[] = [];
  const diagnostics: EvaluationDiagnostic[] = [];

  for (const outcome of input.outcomes) {
    if (!outcome.outcomeFinal) continue;
    const order = orders.get(outcome.orderId);
    if (!order) {
      diagnostics.push(diagnostic('MISSING_ORDER', outcome));
      continue;
    }
    const item = items.get(lineKey(outcome.orderId, outcome.productId));
    if (!item) {
      diagnostics.push(diagnostic('MISSING_ORDER_ITEM', outcome));
      continue;
    }
    if ((suppliersByLine.get(lineKey(outcome.orderId, outcome.productId))?.size ?? 0) > 1) {
      diagnostics.push(diagnostic('AMBIGUOUS_SUPPLIER_ALLOCATION', outcome));
      continue;
    }
    if (outcome.filledQty > item.requestedQty) {
      diagnostics.push(diagnostic('FILLED_EXCEEDS_REQUESTED', outcome));
      continue;
    }

    const base = {
      datasetId: order.datasetId,
      orderId: order.id,
      supplierId: outcome.supplierId,
      productId: outcome.productId,
    };
    if (outcome.cancelled) {
      exceptions.push({
        ...base,
        type: 'CANCELLED',
        severity: 'HIGH',
        evidence: {
          requested_qty: item.requestedQty,
          filled_qty: outcome.filledQty,
          outcome_id: outcome.id,
          cancelled: true,
        },
      });
      continue;
    }
    if (outcome.filledQty === 0) {
      exceptions.push({
        ...base,
        type: 'UNFULFILLED',
        severity: 'HIGH',
        evidence: {
          requested_qty: item.requestedQty,
          filled_qty: 0,
          outcome_id: outcome.id,
          cancelled: false,
        },
      });
    } else if (outcome.filledQty < item.requestedQty) {
      exceptions.push({
        ...base,
        type: 'PARTIAL_FILL',
        severity: 'MEDIUM',
        evidence: {
          requested_qty: item.requestedQty,
          filled_qty: outcome.filledQty,
          outcome_id: outcome.id,
        },
      });
    }

    if (!outcome.deliveredAt) continue;
    const promise = resolveApplicablePromise(
      outcome.orderId,
      outcome.supplierId,
      outcome.productId,
      input.offers,
      input.decisions
    );
    if (promise.status === 'AMBIGUOUS') {
      diagnostics.push(diagnostic('AMBIGUOUS_PROMISE', outcome));
      continue;
    }
    if (promise.status !== 'AVAILABLE' || !promise.promisedDeliveryAt || !promise.offerId) continue;
    const latenessMinutes = differenceMinutes(outcome.deliveredAt, promise.promisedDeliveryAt);
    if (latenessMinutes > 0) {
      exceptions.push({
        ...base,
        type: 'LATE_DELIVERY',
        severity: 'MEDIUM',
        evidence: {
          outcome_id: outcome.id,
          offer_id: promise.offerId,
          decision_id: promise.decisionId,
          promised_delivery_at: promise.promisedDeliveryAt,
          actual_delivered_at: outcome.deliveredAt,
          lateness_minutes: latenessMinutes,
        },
      });
    }
  }

  return { exceptions, diagnostics };
}

export function resolveApplicablePromise(
  orderId: string,
  supplierId: string,
  productId: string,
  offers: OperationalOffer[],
  decisions: OperationalDecision[]
): ApplicablePromise {
  const orderDecisions = decisions.filter((decision) => decision.orderId === orderId);
  if (orderDecisions.length > 0) {
    const latestAt = orderDecisions
      .map((decision) => timestamp(decision.decidedAt))
      .reduce((latest, current) => Math.max(latest, current));
    const latest = orderDecisions.filter((decision) => timestamp(decision.decidedAt) === latestAt);
    const selected = new Set(latest.map((decision) => decision.selectedSupplierId));
    if (selected.size !== 1) return unavailable('AMBIGUOUS');
    const decision = [...latest].sort((left, right) => left.id.localeCompare(right.id))[0];
    if (decision.selectedSupplierId !== supplierId) return unavailable('INSUFFICIENT_DATA');
    const eligible = offers.filter(
      (offer) =>
        offer.orderId === orderId &&
        offer.supplierId === supplierId &&
        offer.productId === productId &&
        offer.promisedDeliveryAt !== null &&
        timestamp(offer.offeredAt) <= latestAt
    );
    return chooseLatestPromise(eligible, decision.id);
  }

  const eligible = offers.filter(
    (offer) =>
      offer.orderId === orderId &&
      offer.supplierId === supplierId &&
      offer.productId === productId &&
      offer.promisedDeliveryAt !== null
  );
  if (eligible.length === 0) return unavailable('INSUFFICIENT_DATA');
  const promisedTimes = new Set(eligible.map((offer) => timestamp(offer.promisedDeliveryAt!)));
  if (promisedTimes.size !== 1) return unavailable('AMBIGUOUS');
  const chosen = [...eligible].sort(compareOffersNewestFirst)[0];
  return {
    status: 'AVAILABLE',
    offerId: chosen.id,
    promisedDeliveryAt: chosen.promisedDeliveryAt,
    decisionId: null,
  };
}

function chooseLatestPromise(offers: OperationalOffer[], decisionId: string): ApplicablePromise {
  if (offers.length === 0) return unavailable('INSUFFICIENT_DATA');
  const latestAt = Math.max(...offers.map((offer) => timestamp(offer.offeredAt)));
  const latest = offers.filter((offer) => timestamp(offer.offeredAt) === latestAt);
  const promises = new Set(latest.map((offer) => timestamp(offer.promisedDeliveryAt!)));
  if (promises.size !== 1) return unavailable('AMBIGUOUS');
  const chosen = [...latest].sort((left, right) => left.id.localeCompare(right.id))[0];
  return {
    status: 'AVAILABLE',
    offerId: chosen.id,
    promisedDeliveryAt: chosen.promisedDeliveryAt,
    decisionId,
  };
}

function finalSuppliersByLine(input: OperationalEvaluationInput): Map<string, Set<string>> {
  const values = new Map<string, Set<string>>();
  for (const outcome of input.outcomes) {
    if (!outcome.outcomeFinal) continue;
    const key = lineKey(outcome.orderId, outcome.productId);
    const suppliers = values.get(key) ?? new Set<string>();
    suppliers.add(outcome.supplierId);
    values.set(key, suppliers);
  }
  return values;
}

function diagnostic(
  code: EvaluationDiagnostic['code'],
  outcome: OperationalEvaluationInput['outcomes'][number]
): EvaluationDiagnostic {
  return {
    code,
    orderId: outcome.orderId,
    supplierId: outcome.supplierId,
    productId: outcome.productId,
    outcomeId: outcome.id,
  };
}

function unavailable(status: 'INSUFFICIENT_DATA' | 'AMBIGUOUS'): ApplicablePromise {
  return { status, offerId: null, promisedDeliveryAt: null, decisionId: null };
}

function compareOffersNewestFirst(left: OperationalOffer, right: OperationalOffer): number {
  return timestamp(right.offeredAt) - timestamp(left.offeredAt) || left.id.localeCompare(right.id);
}

function differenceMinutes(later: string, earlier: string): number {
  return Math.floor((timestamp(later) - timestamp(earlier)) / 60_000);
}

function timestamp(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid persisted timestamp: ${value}`);
  return result;
}

function lineKey(orderId: string, productId: string): string {
  return `${orderId}\u0000${productId}`;
}
