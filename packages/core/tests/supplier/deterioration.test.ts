import { describe, expect, it } from 'vitest';
import { evaluateSupplierReliability, type SupplierOrderObservation } from '../../src/index';

const AS_OF = '2026-08-14T00:00:00Z';

describe('Phase 4 supplier deterioration', () => {
  it('returns HEALTHY when no meaningful trigger fires', () => {
    const result = evaluateSupplierReliability('dataset', 'supplier', series(), AS_OF);
    expect(result.status).toBe('HEALTHY');
    expect(result.triggers).toEqual([]);
  });

  it('returns WATCH for exactly one normal trigger', () => {
    const values = series({ recent: (index) => index === 0
      ? { filledUnits: 9, fullyFilled: false, partialFill: true, otifEligible: false, otif: null }
      : {} });
    const result = evaluateSupplierReliability('dataset', 'supplier', values, AS_OF);
    expect(result.status).toBe('WATCH');
    expect(result.triggers.map((value) => value.code)).toEqual(['PARTIAL_FILL_INCREASE']);
  });

  it('returns HIGH for two or more triggers', () => {
    const values = series({ recent: () => ({ filledUnits: 8, fullyFilled: false, partialFill: true, otif: false }) });
    const result = evaluateSupplierReliability('dataset', 'supplier', values, AS_OF);
    expect(result.status).toBe('HIGH');
    expect(result.triggers.length).toBeGreaterThanOrEqual(2);
  });

  it('returns HIGH for a severe fill-rate drop alone', () => {
    const values = series({
      recent: (index) => index < 2
        ? {
            filledUnits: 0,
            fullyFilled: false,
            otifEligible: false,
            otif: null,
            deliveryCompletionAt: null,
            leadTimeMinutes: null,
          }
        : {},
    });
    const result = evaluateSupplierReliability('dataset', 'supplier', values, AS_OF);
    expect(result.status).toBe('HIGH');
    expect(result.triggers).toContainEqual(expect.objectContaining({ code: 'FILL_RATE_DROP', severe: true }));
  });

  it('returns INSUFFICIENT_DATA below the 10/20 sample minimums', () => {
    const result = evaluateSupplierReliability('dataset', 'supplier', series().slice(0, 29), AS_OF);
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.triggers).toEqual([]);
  });

  it('uses inclusive recent and baseline-start boundaries with an exclusive baseline end', () => {
    const values = [
      observation('as-of', AS_OF),
      observation('recent-start', '2026-07-31T00:00:00Z'),
      observation('baseline-end-before', '2026-07-30T23:59:59.999Z'),
      observation('baseline-start', '2026-07-03T00:00:00Z'),
      observation('outside', '2026-07-02T23:59:59.999Z'),
    ];
    const result = evaluateSupplierReliability('dataset', 'supplier', values, AS_OF);
    expect(result.recent.evaluatedOrders).toBe(2);
    expect(result.baseline.evaluatedOrders).toBe(2);
  });

  it('is deterministic across identical reruns', () => {
    const values = series();
    expect(evaluateSupplierReliability('dataset', 'supplier', values, AS_OF)).toEqual(
      evaluateSupplierReliability('dataset', 'supplier', values, AS_OF)
    );
  });
});

function series(options: {
  recent?: (index: number) => Partial<SupplierOrderObservation>;
  baseline?: (index: number) => Partial<SupplierOrderObservation>;
} = {}): SupplierOrderObservation[] {
  return [
    ...Array.from({ length: 20 }, (_, index) =>
      observation(`baseline-${index}`, `2026-07-${String(4 + index).padStart(2, '0')}T00:00:00Z`, options.baseline?.(index))
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      observation(`recent-${index}`, `2026-08-${String(1 + index).padStart(2, '0')}T00:00:00Z`, options.recent?.(index))
    ),
  ];
}

function observation(
  orderId: string,
  placedAt: string,
  change: Partial<SupplierOrderObservation> = {}
): SupplierOrderObservation {
  return {
    datasetId: 'dataset', supplierId: 'supplier', orderId, placedAt,
    requestedUnits: 10, filledUnits: 10, cancellationAffected: false, fullyFilled: true,
    partialFill: false, otifEligible: true, otif: true, deliveryCompletionAt: placedAt,
    leadTimeMinutes: 60, outcomeIds: [], productIds: [], ...change,
  };
}
