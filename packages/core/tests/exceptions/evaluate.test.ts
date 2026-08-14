import { describe, expect, it } from 'vitest';
import {
  evaluateOrderExceptions,
  type OperationalEvaluationInput,
} from '../../src/index';

describe('Phase 4 order exceptions', () => {
  it.each([
    [{ cancelled: true, filledQty: 0 }, 'CANCELLED'],
    [{ cancelled: false, filledQty: 0 }, 'UNFULFILLED'],
    [{ cancelled: false, filledQty: 5 }, 'PARTIAL_FILL'],
  ] as const)('classifies explicit final outcomes %j as %s', (change, expected) => {
    const input = fixture();
    Object.assign(input.outcomes[0], change);
    expect(evaluateOrderExceptions(input).exceptions.map((value) => value.type)).toContain(expected);
  });

  it('does not invent a partial-fill exception for a full fill or a missing outcome', () => {
    const full = fixture();
    expect(evaluateOrderExceptions(full).exceptions).toHaveLength(0);
    full.outcomes = [];
    expect(evaluateOrderExceptions(full).exceptions).toHaveLength(0);
  });

  it('does not guess when the applicable promise is ambiguous', () => {
    const input = fixture();
    input.outcomes[0].deliveredAt = '2026-08-12T12:00:00Z';
    input.offers.push({
      id: 'offer-2', orderId: 'order', supplierId: 'supplier', productId: 'product',
      offeredAt: '2026-08-10T01:00:00Z', promisedDeliveryAt: '2026-08-11T13:00:00Z',
    });
    const result = evaluateOrderExceptions(input);
    expect(result.exceptions.some((value) => value.type === 'LATE_DELIVERY')).toBe(false);
    expect(result.diagnostics.some((value) => value.code === 'AMBIGUOUS_PROMISE')).toBe(true);
  });

  it('never uses an offer created after the procurement decision', () => {
    const input = fixture();
    input.decisions = [{ id: 'decision', orderId: 'order', selectedSupplierId: 'supplier', decidedAt: '2026-08-10T02:00:00Z' }];
    input.offers[0].offeredAt = '2026-08-10T03:00:00Z';
    input.outcomes[0].deliveredAt = '2026-08-12T12:00:00Z';
    expect(evaluateOrderExceptions(input).exceptions.some((value) => value.type === 'LATE_DELIVERY')).toBe(false);
  });

  it('emits LATE_DELIVERY with the real decision-time offer evidence', () => {
    const input = fixture();
    input.decisions = [{ id: 'decision', orderId: 'order', selectedSupplierId: 'supplier', decidedAt: '2026-08-10T02:00:00Z' }];
    input.outcomes[0].deliveredAt = '2026-08-12T12:00:00Z';
    const late = evaluateOrderExceptions(input).exceptions.find((value) => value.type === 'LATE_DELIVERY');
    expect(late?.evidence).toMatchObject({ offer_id: 'offer', decision_id: 'decision', lateness_minutes: 1440 });
  });

  it('reports filled quantity above requested as unevaluable without clamping it', () => {
    const input = fixture();
    input.outcomes[0].filledQty = 11;
    const result = evaluateOrderExceptions(input);
    expect(result.exceptions).toHaveLength(0);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'FILLED_EXCEEDS_REQUESTED' }));
  });
});

function fixture(): OperationalEvaluationInput {
  return {
    orders: [{ id: 'order', datasetId: 'dataset', placedAt: '2026-08-10T00:00:00Z' }],
    items: [{ id: 'item', orderId: 'order', productId: 'product', requestedQty: 10 }],
    outcomes: [{
      id: 'outcome', orderId: 'order', supplierId: 'supplier', productId: 'product',
      filledQty: 10, deliveredAt: '2026-08-11T12:00:00Z', cancelled: false, outcomeFinal: true,
    }],
    offers: [{
      id: 'offer', orderId: 'order', supplierId: 'supplier', productId: 'product',
      offeredAt: '2026-08-10T01:00:00Z', promisedDeliveryAt: '2026-08-11T12:00:00Z',
    }],
    decisions: [],
  };
}
