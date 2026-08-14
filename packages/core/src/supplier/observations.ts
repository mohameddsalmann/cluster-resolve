import { resolveApplicablePromise } from '../exceptions/evaluate';
import type { EvaluationDiagnostic, OperationalOutcome } from '../exceptions/types';
import type {
  ObservationBuildResult,
  SupplierObservationInput,
  SupplierOrderObservation,
} from './types';

export function buildSupplierOrderObservations(
  input: SupplierObservationInput
): ObservationBuildResult {
  const orders = new Map(input.orders.map((order) => [order.id, order]));
  const items = new Map(input.items.map((item) => [lineKey(item.orderId, item.productId), item]));
  const suppliersByLine = new Map<string, Set<string>>();
  for (const outcome of input.outcomes.filter((value) => value.outcomeFinal)) {
    const key = lineKey(outcome.orderId, outcome.productId);
    const suppliers = suppliersByLine.get(key) ?? new Set<string>();
    suppliers.add(outcome.supplierId);
    suppliersByLine.set(key, suppliers);
  }

  const groups = groupBy(input.outcomes, (outcome) => groupKey(outcome.orderId, outcome.supplierId));
  const observations: SupplierOrderObservation[] = [];
  const diagnostics: EvaluationDiagnostic[] = [];

  for (const outcomes of groups.values()) {
    const first = outcomes[0];
    const order = orders.get(first.orderId);
    if (!order) {
      diagnostics.push(diagnostic('MISSING_ORDER', first));
      continue;
    }
    if (outcomes.some((outcome) => !outcome.outcomeFinal)) {
      diagnostics.push(diagnostic('NON_FINAL_OUTCOME', first));
      continue;
    }

    let invalid = false;
    const lines = outcomes.map((outcome) => {
      const item = items.get(lineKey(outcome.orderId, outcome.productId));
      if (!item) {
        diagnostics.push(diagnostic('MISSING_ORDER_ITEM', outcome));
        invalid = true;
        return null;
      }
      if ((suppliersByLine.get(lineKey(outcome.orderId, outcome.productId))?.size ?? 0) > 1) {
        diagnostics.push(diagnostic('AMBIGUOUS_SUPPLIER_ALLOCATION', outcome));
        invalid = true;
        return null;
      }
      if (outcome.filledQty > item.requestedQty) {
        diagnostics.push(diagnostic('FILLED_EXCEEDS_REQUESTED', outcome));
        invalid = true;
        return null;
      }
      return { outcome, item };
    });
    if (invalid) continue;
    const validLines = lines.filter((line): line is NonNullable<typeof line> => line !== null);
    if (validLines.length === 0) continue;

    const requestedUnits = validLines.reduce((sum, line) => sum + line.item.requestedQty, 0);
    const filledUnits = validLines.reduce((sum, line) => sum + line.outcome.filledQty, 0);
    const cancellationAffected = validLines.some((line) => line.outcome.cancelled);
    const fullyFilled = !cancellationAffected && filledUnits === requestedUnits;
    const partialFill = filledUnits > 0 && filledUnits < requestedUnits;

    const linePromises = validLines.map((line) => ({
      line,
      promise: resolveApplicablePromise(
        order.id,
        first.supplierId,
        line.item.productId,
        input.offers,
        input.decisions
      ),
    }));
    for (const value of linePromises.filter((value) => value.promise.status === 'AMBIGUOUS')) {
      diagnostics.push(diagnostic('AMBIGUOUS_PROMISE', value.line.outcome));
    }
    const otifEligible = linePromises.every(
      ({ line, promise }) =>
        line.outcome.deliveredAt !== null && promise.status === 'AVAILABLE'
    );
    const otif = otifEligible
      ? fullyFilled && linePromises.every(({ line, promise }) =>
          timestamp(line.outcome.deliveredAt!) <= timestamp(promise.promisedDeliveryAt!)
        )
      : null;

    const delivered = validLines.map((line) => line.outcome.deliveredAt);
    let deliveryCompletionAt: string | null = null;
    let leadTimeMinutes: number | null = null;
    if (delivered.every((value): value is string => value !== null)) {
      deliveryCompletionAt = [...delivered].sort((left, right) => timestamp(right) - timestamp(left))[0];
      const difference = Math.floor((timestamp(deliveryCompletionAt) - timestamp(order.placedAt)) / 60_000);
      if (difference < 0) diagnostics.push(diagnostic('INVALID_LEAD_TIME', first));
      else leadTimeMinutes = difference;
    }

    observations.push({
      datasetId: order.datasetId,
      supplierId: first.supplierId,
      orderId: order.id,
      placedAt: order.placedAt,
      requestedUnits,
      filledUnits,
      cancellationAffected,
      fullyFilled,
      partialFill,
      otifEligible,
      otif,
      deliveryCompletionAt,
      leadTimeMinutes,
      outcomeIds: validLines.map((line) => line.outcome.id).sort(),
      productIds: validLines.map((line) => line.outcome.productId).sort(),
    });
  }
  return { observations, diagnostics };
}

function diagnostic(code: EvaluationDiagnostic['code'], outcome: OperationalOutcome): EvaluationDiagnostic {
  return {
    code,
    orderId: outcome.orderId,
    supplierId: outcome.supplierId,
    productId: outcome.productId,
    outcomeId: outcome.id,
  };
}

function timestamp(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid persisted timestamp: ${value}`);
  return result;
}

function lineKey(orderId: string, productId: string): string {
  return `${orderId}\u0000${productId}`;
}

function groupKey(orderId: string, supplierId: string): string {
  return `${orderId}\u0000${supplierId}`;
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) groups.set(key(value), [...(groups.get(key(value)) ?? []), value]);
  return groups;
}
