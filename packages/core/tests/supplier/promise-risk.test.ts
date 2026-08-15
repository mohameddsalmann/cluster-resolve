import { describe, expect, it } from 'vitest';
import {
  calculatePromiseRiskMetrics,
  evaluateCurrentOfferPromiseRisk,
} from '../../src/supplier/promise-risk';
import type { ReliabilityMetrics, SupplierOrderObservation } from '../../src/supplier/types';

describe('Supplier Promise Risk Engine', () => {
  describe('calculatePromiseRiskMetrics (Historical Promise Fidelity)', () => {
    it('returns INSUFFICIENT_DATA when fewer than 5 orders had a promised delivery date', () => {
      const observations: SupplierOrderObservation[] = [
        makeObs({ promisedDeliveryAt: '2026-08-10T12:00:00.000Z', deliveryCompletionAt: '2026-08-10T11:00:00.000Z' }),
        makeObs({ promisedDeliveryAt: '2026-08-11T12:00:00.000Z', deliveryCompletionAt: '2026-08-11T11:00:00.000Z' }),
      ];
      const result = calculatePromiseRiskMetrics(observations);
      expect(result.promiseRiskLevel).toBe('INSUFFICIENT_DATA');
      expect(result.promiseGivenCount).toBe(2);
      expect(result.promiseHonouredBps).toBeNull();
    });

    it('classifies LOW risk when >= 85% of promises are honoured', () => {
      const observations: SupplierOrderObservation[] = Array.from({ length: 10 }, (_, i) =>
        makeObs({
          orderId: `ORD-${i}`,
          promisedDeliveryAt: '2026-08-10T12:00:00.000Z',
          deliveryCompletionAt: i === 0 ? '2026-08-10T14:00:00.000Z' : '2026-08-10T11:00:00.000Z', // 9/10 = 90%
        })
      );
      const result = calculatePromiseRiskMetrics(observations);
      expect(result.promiseRiskLevel).toBe('LOW');
      expect(result.promiseHonouredCount).toBe(9);
      expect(result.promiseHonouredBps).toBe(9000);
    });

    it('classifies HIGH risk when < 70% of promises are honoured', () => {
      const observations: SupplierOrderObservation[] = Array.from({ length: 10 }, (_, i) =>
        makeObs({
          orderId: `ORD-${i}`,
          promisedDeliveryAt: '2026-08-10T12:00:00.000Z',
          deliveryCompletionAt: i < 4 ? '2026-08-10T11:00:00.000Z' : '2026-08-10T16:00:00.000Z', // 4/10 = 40%
        })
      );
      const result = calculatePromiseRiskMetrics(observations);
      expect(result.promiseRiskLevel).toBe('HIGH');
      expect(result.promiseHonouredCount).toBe(4);
      expect(result.promiseHonouredBps).toBe(4000);
    });
  });

  describe('evaluateCurrentOfferPromiseRisk (Current Recorded Offer Evaluation)', () => {
    const strongSupplierMetrics: ReliabilityMetrics = {
      evaluatedOrders: 50,
      fillRateBps: 9800,
      otifRateBps: 9500,
      cancellationRateBps: 100,
      partialFillRateBps: 200,
      leadTimeP50Minutes: 720, // 12h
      leadTimeP95Minutes: 1440, // 24h
    };

    it('returns LOW risk when current promise aligns with historical metrics', () => {
      const result = evaluateCurrentOfferPromiseRisk({
        requestedQty: 100,
        availableQty: 100,
        promisedDeliveryAt: '2026-08-11T10:00:00.000Z', // 24h later
        orderPlacedAt: '2026-08-10T10:00:00.000Z',
        supplierMetrics: strongSupplierMetrics,
      });
      expect(result.level).toBe('LOW');
      expect(result.evidenceSource).toBe('SUPPLIER');
      expect(result.triggers).toHaveLength(0);
      expect(result.currentOffer.promisedLeadTimeMinutes).toBe(1440);
    });

    it('returns HIGH risk when promised delivery is materially below historical P95 lead time', () => {
      const result = evaluateCurrentOfferPromiseRisk({
        requestedQty: 100,
        availableQty: 100,
        promisedDeliveryAt: '2026-08-10T14:00:00.000Z', // 4h promised vs 24h P95 (1440m)
        orderPlacedAt: '2026-08-10T10:00:00.000Z',
        supplierMetrics: strongSupplierMetrics,
      });
      expect(result.level).toBe('HIGH');
      expect(result.triggers.some((t) => t.code === 'LEAD_TIME_BELOW_P95' && t.severity === 'CRITICAL')).toBe(true);
    });

    it('returns WATCH risk for moderately aggressive promise below median lead time', () => {
      const result = evaluateCurrentOfferPromiseRisk({
        requestedQty: 100,
        availableQty: 100,
        promisedDeliveryAt: '2026-08-10T16:00:00.000Z', // 6h promised vs 12h P50 (720m)
        orderPlacedAt: '2026-08-10T10:00:00.000Z',
        supplierMetrics: {
          ...strongSupplierMetrics,
          leadTimeP95Minutes: 600, // 10h P95 -> 6h is 60% of P95, not below 0.6
          leadTimeP50Minutes: 600, // 6h < 0.7 * 10h (7h)
        },
      });
      expect(result.level).toBe('WATCH');
      expect(result.triggers.some((t) => t.code === 'LEAD_TIME_BELOW_P50')).toBe(true);
    });

    it('prefers product-level evidence when sufficient observations exist', () => {
      const productMetrics: ReliabilityMetrics = {
        evaluatedOrders: 15,
        fillRateBps: 4500, // severely depressed for this product (45%)
        otifRateBps: 4000,
        cancellationRateBps: 3000,
        partialFillRateBps: 2500,
        leadTimeP50Minutes: 1200,
        leadTimeP95Minutes: 2400,
      };

      const result = evaluateCurrentOfferPromiseRisk({
        requestedQty: 50,
        availableQty: 50,
        promisedDeliveryAt: '2026-08-11T10:00:00.000Z',
        orderPlacedAt: '2026-08-10T10:00:00.000Z',
        productMetrics,
        supplierMetrics: strongSupplierMetrics, // overall supplier looks good
      });

      // Product evidence triggers CRITICAL fill rate drop + cancellation
      expect(result.level).toBe('HIGH');
      expect(result.evidenceSource).toBe('PRODUCT');
      expect(result.historicalEvidence.fillRateBps).toBe(4500);
      expect(result.triggers.some((t) => t.code === 'POOR_FILL_RATE_HISTORY')).toBe(true);
    });

    it('falls back to supplier-level evidence when product-level sample is too small (< 5)', () => {
      const productMetrics: ReliabilityMetrics = {
        evaluatedOrders: 2, // < 5
        fillRateBps: 5000,
        otifRateBps: 5000,
        cancellationRateBps: 0,
        partialFillRateBps: 0,
        leadTimeP50Minutes: 500,
        leadTimeP95Minutes: 1000,
      };

      const result = evaluateCurrentOfferPromiseRisk({
        requestedQty: 50,
        availableQty: 50,
        promisedDeliveryAt: '2026-08-11T10:00:00.000Z',
        orderPlacedAt: '2026-08-10T10:00:00.000Z',
        productMetrics,
        supplierMetrics: strongSupplierMetrics,
      });

      expect(result.level).toBe('LOW');
      expect(result.evidenceSource).toBe('SUPPLIER');
      expect(result.historicalEvidence.fillRateBps).toBe(9800);
    });

    it('returns INSUFFICIENT_DATA when both product and supplier samples are below threshold', () => {
      const result = evaluateCurrentOfferPromiseRisk({
        requestedQty: 50,
        availableQty: 50,
        promisedDeliveryAt: '2026-08-11T10:00:00.000Z',
        orderPlacedAt: '2026-08-10T10:00:00.000Z',
        supplierMetrics: {
          evaluatedOrders: 3, // < 5
          fillRateBps: null,
          otifRateBps: null,
          cancellationRateBps: null,
          partialFillRateBps: null,
          leadTimeP50Minutes: null,
          leadTimeP95Minutes: null,
        },
      });

      expect(result.level).toBe('INSUFFICIENT_DATA');
      expect(result.evidenceSource).toBe('NONE');
      expect(result.triggers).toHaveLength(0);
    });
  });
});

function makeObs(overrides: Partial<SupplierOrderObservation>): SupplierOrderObservation {
  return {
    datasetId: 'ds-test',
    supplierId: 'sup-test',
    orderId: 'ord-test',
    placedAt: '2026-08-01T00:00:00.000Z',
    requestedUnits: 10,
    filledUnits: 10,
    cancellationAffected: false,
    fullyFilled: true,
    partialFill: false,
    otifEligible: true,
    otif: true,
    deliveryCompletionAt: '2026-08-01T12:00:00.000Z',
    leadTimeMinutes: 720,
    outcomeIds: ['out-1'],
    productIds: ['prod-1'],
    promisedDeliveryAt: null,
    ...overrides,
  };
}
