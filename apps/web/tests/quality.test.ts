import { describe, expect, it } from 'vitest';
import { calculateDatasetQuality } from '../lib/imports/quality';

describe('dataset quality calculation', () => {
  it('computes final-outcome and historical-offer coverage', () => {
    const quality = calculateDatasetQuality(
      'dataset',
      [{ id: 'order-1' }, { id: 'order-2' }],
      [
        { order_id: 'order-1', product_id: 'product-1' },
        { order_id: 'order-2', product_id: 'product-2' },
      ],
      [{ order_id: 'order-1', product_id: 'product-1', outcome_final: true }],
      [{ order_id: 'order-1', decided_at: '2026-08-14T10:00:00.000Z' }],
      [
        { order_id: 'order-1', supplier_id: 'supplier-1', offered_at: '2026-08-14T09:00:00.000Z' },
        { order_id: 'order-1', supplier_id: 'supplier-2', offered_at: '2026-08-14T09:30:00.000Z' },
      ],
      [{ id: 'job', kind: 'OUTCOMES', processed_rows: 2, valid_rows: 1, error_rows: 1 }],
      [{ job_id: 'job', code: 'UNKNOWN_ORDER' }]
    );

    expect(quality.coverage.ordersReadyForPhase4.percentage).toBe('50.00');
    expect(quality.coverage.decisionsWithComparativeOffers.state).toBe('AVAILABLE');
    expect(quality.rejectedReferences.attemptedOrphanOutcomes).toBe(1);
  });
});
