import { describe, expect, it } from 'vitest';
import {
  evaluateDecisionReplay,
  type DecisionReplayEvaluationInput,
} from '../../src/index';

function createBaseFixture(): DecisionReplayEvaluationInput {
  return {
    decisionId: 'dec-1',
    externalDecisionId: 'DEC-1001',
    datasetId: 'dataset-1',
    orderId: 'ord-1',
    externalOrderId: 'ORD-1001',
    orderPlacedAt: '2026-08-10T10:00:00Z',
    pharmacyName: 'Al-Shifa Pharmacy',
    selectedSupplierId: 'supp-A',
    decidedAt: '2026-08-10T12:00:00Z',
    agentName: 'ProcureAgent',
    agentVersion: '1.0.0',
    confidence: '0.95',
    selectionReason: 'Lowest unit price among available quotes',
    orderItems: [
      {
        productId: 'prod-1',
        externalProductId: 'SKU-100',
        productName: 'Amoxicillin 500mg',
        requestedQty: 100,
        unit: 'pack',
      },
    ],
    rawOffers: [
      {
        id: 'off-A',
        externalOfferId: 'OFF-A1',
        orderId: 'ord-1',
        supplierId: 'supp-A',
        supplierName: 'Supplier Alpha',
        externalSupplierId: 'SUPP-A',
        productId: 'prod-1',
        availableQty: 100,
        unitPriceMinor: 1200n, // EGP 12.00 -> total EGP 1,200
        discountBps: 0,
        promisedDeliveryAt: '2026-08-10T20:00:00Z', // 8h after decision
        offeredAt: '2026-08-10T11:00:00Z',
      },
      {
        id: 'off-B',
        externalOfferId: 'OFF-B1',
        orderId: 'ord-1',
        supplierId: 'supp-B',
        supplierName: 'Supplier Beta',
        externalSupplierId: 'SUPP-B',
        productId: 'prod-1',
        availableQty: 100,
        unitPriceMinor: 1150n, // EGP 11.50 -> total EGP 1,150 (Cheaper!)
        discountBps: 0,
        promisedDeliveryAt: '2026-08-10T18:00:00Z', // 6h after decision (Faster!)
        offeredAt: '2026-08-10T11:30:00Z',
      },
    ],
    selectedOutcome: {
      id: 'out-1',
      orderId: 'ord-1',
      supplierId: 'supp-A',
      productId: 'prod-1',
      filledQty: 100,
      deliveredAt: '2026-08-10T20:30:00Z',
      cancelled: false,
      cancellationReason: null,
      outcomeFinal: true,
    },
  };
}

describe('Decision Replay & Decision Quality Engine', () => {
  it('excludes future offers where offered_at > decided_at', () => {
    const fixture = createBaseFixture();
    // Add an offer that was submitted AFTER the decision
    fixture.rawOffers.push({
      id: 'off-future',
      externalOfferId: 'OFF-FUTURE',
      orderId: 'ord-1',
      supplierId: 'supp-C',
      supplierName: 'Supplier Future',
      externalSupplierId: 'SUPP-C',
      productId: 'prod-1',
      availableQty: 200,
      unitPriceMinor: 500n,
      discountBps: 0,
      promisedDeliveryAt: '2026-08-10T14:00:00Z',
      offeredAt: '2026-08-10T13:00:00Z', // 1h AFTER decision
    });

    const result = evaluateDecisionReplay(fixture);
    expect(result.futureOffersExcludedCount).toBe(1);
    expect(result.consideredOffersCount).toBe(2);
    expect(result.candidates.some((c) => c.supplierId === 'supp-C')).toBe(false);
  });

  it('classifies as DOMINATED when alternative is cheaper and faster', () => {
    const fixture = createBaseFixture();
    const result = evaluateDecisionReplay(fixture);

    expect(result.classification).toBe('DOMINATED');
    expect(result.dominatingSupplier?.supplierId).toBe('supp-B');
    expect(result.quotedPriceGapMinor).toBe(5000n); // (1200 - 1150) * 100 = 50.00 EGP = 5000 piastres
    expect(result.promisedDeliveryGapMinutes).toBe(120); // 2 hours faster
  });

  it('classifies as DOMINATED when alternative is cheaper with equal delivery', () => {
    const fixture = createBaseFixture();
    // Change Supplier B delivery to match Supplier A (8h)
    fixture.rawOffers[1].promisedDeliveryAt = '2026-08-10T20:00:00Z';

    const result = evaluateDecisionReplay(fixture);
    expect(result.classification).toBe('DOMINATED');
    expect(result.dominatingSupplier?.supplierId).toBe('supp-B');
  });

  it('classifies as DOMINATED when alternative has same price but faster delivery', () => {
    const fixture = createBaseFixture();
    // Supplier B has same price as Supplier A but delivers 2h faster
    fixture.rawOffers[1].unitPriceMinor = 1200n;
    fixture.rawOffers[1].promisedDeliveryAt = '2026-08-10T18:00:00Z';

    const result = evaluateDecisionReplay(fixture);
    expect(result.classification).toBe('DOMINATED');
    expect(result.dominatingSupplier?.supplierId).toBe('supp-B');
  });

  it('classifies as NON_DOMINATED when alternative is cheaper but arrives later', () => {
    const fixture = createBaseFixture();
    // Supplier B is cheaper (1150) but arrives later (22:00 vs 20:00)
    fixture.rawOffers[1].promisedDeliveryAt = '2026-08-10T22:00:00Z';

    const result = evaluateDecisionReplay(fixture);
    expect(result.classification).toBe('NON_DOMINATED');
    expect(result.dominatingSupplier).toBeNull();
  });

  it('classifies as NON_DOMINATED when alternative is faster but more expensive', () => {
    const fixture = createBaseFixture();
    // Supplier B is faster (18:00 vs 20:00) but more expensive (1300 vs 1200)
    fixture.rawOffers[1].unitPriceMinor = 1300n;
    fixture.rawOffers[1].promisedDeliveryAt = '2026-08-10T18:00:00Z';

    const result = evaluateDecisionReplay(fixture);
    expect(result.classification).toBe('NON_DOMINATED');
    expect(result.dominatingSupplier).toBeNull();
  });

  it('classifies as NON_DOMINATED when alternative has identical price and delivery', () => {
    const fixture = createBaseFixture();
    // Supplier B is exactly identical to Supplier A
    fixture.rawOffers[1].unitPriceMinor = 1200n;
    fixture.rawOffers[1].promisedDeliveryAt = '2026-08-10T20:00:00Z';

    const result = evaluateDecisionReplay(fixture);
    expect(result.classification).toBe('NON_DOMINATED');
    expect(result.dominatingSupplier).toBeNull();
  });

  it('classifies as SELECTED_NOT_FEASIBLE when selected supplier lacked required quantity', () => {
    const fixture = createBaseFixture();
    // Supplier A only had 50 units when 100 were requested
    fixture.rawOffers[0].availableQty = 50;

    const result = evaluateDecisionReplay(fixture);
    expect(result.classification).toBe('SELECTED_NOT_FEASIBLE');
    expect(result.selectedCandidate?.isFeasible).toBe(false);
  });

  it('classifies as INSUFFICIENT_DATA when no decision-time offers exist', () => {
    const fixture = createBaseFixture();
    fixture.rawOffers = [];

    const result = evaluateDecisionReplay(fixture);
    expect(result.classification).toBe('INSUFFICIENT_DATA');
  });

  it('evaluates multi-item order feasibility accurately', () => {
    const fixture = createBaseFixture();
    // Order has 2 items
    fixture.orderItems.push({
      productId: 'prod-2',
      externalProductId: 'SKU-200',
      productName: 'Paracetamol 500mg',
      requestedQty: 50,
      unit: 'bottle',
    });

    // Supplier A has offers for BOTH items
    fixture.rawOffers.push({
      id: 'off-A2',
      externalOfferId: 'OFF-A2',
      orderId: 'ord-1',
      supplierId: 'supp-A',
      supplierName: 'Supplier Alpha',
      externalSupplierId: 'SUPP-A',
      productId: 'prod-2',
      availableQty: 50,
      unitPriceMinor: 800n,
      discountBps: 0,
      promisedDeliveryAt: '2026-08-10T20:00:00Z',
      offeredAt: '2026-08-10T11:00:00Z',
    });

    // Supplier B is cheaper on SKU-1, but has NO offer for SKU-2!
    // Supplier B must NOT be deemed feasible and cannot dominate the order.
    const result = evaluateDecisionReplay(fixture);
    const candidateB = result.candidates.find((c) => c.supplierId === 'supp-B');
    expect(candidateB?.isFeasible).toBe(false);
    expect(candidateB?.infeasibleReasons).toContain('No offer recorded for product "Paracetamol 500mg"');
    expect(result.classification).toBe('NON_DOMINATED');
  });

  it('records actual selected outcome metrics accurately', () => {
    const fixture = createBaseFixture();
    // Outcome: delivered 80 units (partial fill shortfall = 20) and delivered at 21:00 (60 mins late vs 20:00 promise)
    fixture.selectedOutcome = {
      id: 'out-1',
      orderId: 'ord-1',
      supplierId: 'supp-A',
      productId: 'prod-1',
      filledQty: 80,
      deliveredAt: '2026-08-10T21:00:00Z',
      cancelled: false,
      cancellationReason: null,
      outcomeFinal: true,
    };

    const result = evaluateDecisionReplay(fixture);
    expect(result.selectedActualOutcome?.filledQty).toBe(80);
    expect(result.selectedActualOutcome?.fillRateBps).toBe(8000);
    expect(result.actualSelectedShortfallUnits).toBe(20);
    expect(result.actualSelectedLatenessMinutes).toBe(60);
  });
});
