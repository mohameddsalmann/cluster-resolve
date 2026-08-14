import { describe, expect, it } from 'vitest';
import {
  buildSupplierOrderObservations,
  calculateReliabilityMetrics,
  nearestRankPercentile,
  type SupplierOrderObservation,
} from '../../src/index';

describe('Phase 4 supplier metrics', () => {
  it('calculates exact basis-point rates and lead-time percentiles', () => {
    const metrics = calculateReliabilityMetrics([
      observation({ orderId: 'one', filledUnits: 10, otif: true, leadTimeMinutes: 60 }),
      observation({
        orderId: 'two', filledUnits: 5, partialFill: true, cancellationAffected: true,
        fullyFilled: false, otif: false, leadTimeMinutes: 120,
      }),
    ]);
    expect(metrics).toEqual({
      evaluatedOrders: 2,
      fillRateBps: 7500,
      otifRateBps: 5000,
      cancellationRateBps: 5000,
      partialFillRateBps: 5000,
      leadTimeP50Minutes: 60,
      leadTimeP95Minutes: 120,
    });
  });

  it('excludes missing promises from the OTIF denominator', () => {
    const missing = observation({ orderId: 'missing', otifEligible: false, otif: null });
    const available = observation({ orderId: 'available', otifEligible: true, otif: true });
    expect(calculateReliabilityMetrics([missing, available]).otifRateBps).toBe(10_000);
  });

  it('uses nearest-rank P50 and P95 from underlying observations', () => {
    const values = Array.from({ length: 20 }, (_, index) => index + 1);
    expect(nearestRankPercentile(values, 50)).toBe(10);
    expect(nearestRankPercentile(values, 95)).toBe(19);
  });

  it('uses the final delivered line for supplier/order lead time', () => {
    const result = buildSupplierOrderObservations({
      orders: [{ id: 'order', datasetId: 'dataset', placedAt: '2026-08-10T00:00:00Z' }],
      items: [
        { id: 'i1', orderId: 'order', productId: 'p1', requestedQty: 5 },
        { id: 'i2', orderId: 'order', productId: 'p2', requestedQty: 5 },
      ],
      outcomes: [
        { id: 'o1', orderId: 'order', supplierId: 'supplier', productId: 'p1', filledQty: 5, deliveredAt: '2026-08-10T01:00:00Z', cancelled: false, outcomeFinal: true },
        { id: 'o2', orderId: 'order', supplierId: 'supplier', productId: 'p2', filledQty: 5, deliveredAt: '2026-08-10T03:00:00Z', cancelled: false, outcomeFinal: true },
      ],
      offers: [],
      decisions: [],
    });
    expect(result.observations[0].leadTimeMinutes).toBe(180);
  });
});

function observation(change: Partial<SupplierOrderObservation>): SupplierOrderObservation {
  return {
    datasetId: 'dataset', supplierId: 'supplier', orderId: 'order', placedAt: '2026-08-10T00:00:00Z',
    requestedUnits: 10, filledUnits: 10, cancellationAffected: false, fullyFilled: true,
    partialFill: false, otifEligible: true, otif: true, deliveryCompletionAt: '2026-08-10T01:00:00Z',
    leadTimeMinutes: 60, outcomeIds: [], productIds: [], ...change,
  };
}
