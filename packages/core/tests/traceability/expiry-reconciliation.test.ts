import { describe, expect, it } from 'vitest';
import type { CanonicalTraceabilityEventRecord } from '../../src/eptts/types';
import { determineExpiryBucket, evaluateExpiryIntelligence } from '../../src/traceability/expiry';
import { buildProductLinks, matchProductWithGtin } from '../../src/traceability/gtin-crosswalk';
import { reconcileOrdersWithTraceability } from '../../src/traceability/reconciliation';
import type {
  TraceabilityOrderInput,
  TraceabilityProductCatalogItem,
  TraceabilityProductLink,
} from '../../src/traceability/types';

describe('Traceability Module — Shelf-Life Expiry Intelligence', () => {
  const asOf = '2026-08-15T00:00:00.000Z';
  const asOfMs = Date.parse(asOf);

  it('determines correct expiry buckets', () => {
    // Expired: 2026-08-01 (before Aug 15, 2026)
    expect(determineExpiryBucket('2026-08-01', asOfMs).bucket).toBe('EXPIRED');

    // Expiring <= 90 days: 2026-10-01 (47 days later)
    expect(determineExpiryBucket('2026-10-01', asOfMs).bucket).toBe('EXPIRING_90');

    // Expiring <= 180 days: 2026-12-15 (122 days later)
    expect(determineExpiryBucket('2026-12-15', asOfMs).bucket).toBe('EXPIRING_180');

    // Later: 2028-06-01
    expect(determineExpiryBucket('2028-06-01', asOfMs).bucket).toBe('LATER');

    // Unknown: null or malformed
    expect(determineExpiryBucket(null, asOfMs).bucket).toBe('UNKNOWN');
    expect(determineExpiryBucket('invalid-date', asOfMs).bucket).toBe('UNKNOWN');
  });

  it('evaluates full expiry intelligence summary from canonical events', () => {
    const events: CanonicalTraceabilityEventRecord[] = [
      {
        eventType: 'COMMISSIONING',
        eventTime: '2026-08-01T08:00:00Z',
        epc: '(01)06221234567891(21)SN1',
        gtin: '06221234567891',
        serial: 'SN1',
        expiryDate: '2026-08-01', // Expired
        readPointGln: '6221234567891',
        bizLocationGln: '6221234567891',
        sourceFormat: 'CSV',
        sourceIndex: 1,
      },
      {
        eventType: 'COMMISSIONING',
        eventTime: '2026-08-01T08:05:00Z',
        epc: '(01)06221234567891(21)SN2',
        gtin: '06221234567891',
        serial: 'SN2',
        expiryDate: '2026-10-01', // Expiring 90
        readPointGln: '6221234567891',
        bizLocationGln: '6221234567891',
        sourceFormat: 'CSV',
        sourceIndex: 2,
      },
      {
        eventType: 'COMMISSIONING',
        eventTime: '2026-08-01T08:10:00Z',
        epc: '(01)06221234567891(21)SN3',
        gtin: '06221234567891',
        serial: 'SN3',
        expiryDate: '2027-12-31', // Later
        readPointGln: '6221234567891',
        bizLocationGln: '6221234567891',
        sourceFormat: 'CSV',
        sourceIndex: 3,
      },
      {
        eventType: 'COMMISSIONING',
        eventTime: '2026-08-01T08:15:00Z',
        epc: '(01)06221234567891(21)SN4',
        gtin: '06221234567891',
        serial: 'SN4',
        expiryDate: null, // Unknown
        readPointGln: '6221234567891',
        bizLocationGln: '6221234567891',
        sourceFormat: 'CSV',
        sourceIndex: 4,
      },
    ];

    const { summary, items } = evaluateExpiryIntelligence(events, asOf);
    expect(summary.totalSerializedUnits).toBe(4);
    expect(summary.expiredCount).toBe(1);
    expect(summary.expiring90DaysCount).toBe(1);
    expect(summary.expiring180DaysCount).toBe(0);
    expect(summary.laterCount).toBe(1);
    expect(summary.unknownExpiryCount).toBe(1);
    expect(items).toHaveLength(4);
  });
});

describe('Traceability Module — GTIN Crosswalk & Reconciliation', () => {
  const catalog: TraceabilityProductCatalogItem[] = [
    {
      id: 'prod-amox',
      name: 'Amoxicillin 500mg Capsules',
      nameNormalized: 'amoxicillin 500mg capsules',
      gtin: '06221234567891',
    },
    {
      id: 'prod-para',
      name: 'Paracetamol 500mg Tablets',
      nameNormalized: 'paracetamol 500mg tablets',
      gtin: null,
    },
  ];

  it('matches catalog GTINs as CONFIRMED and description overlap as SUGGESTED', () => {
    const res1 = matchProductWithGtin('06221234567891', null, catalog);
    expect(res1.status).toBe('CONFIRMED');
    expect(res1.productId).toBe('prod-amox');

    const res2 = matchProductWithGtin(
      '06229999000018',
      'Paracetamol 500mg Tablets 20s Box',
      catalog
    );
    expect(res2.status).toBe('SUGGESTED');
    expect(res2.productId).toBe('prod-para');
  });

  it('reconciles orders with traceability events deterministically', () => {
    const datasetId = 'ds-1';
    const productLinks: TraceabilityProductLink[] = [
      {
        datasetId,
        productId: 'prod-amox',
        gtin: '06221234567891',
        status: 'CONFIRMED',
        confidenceReason: 'Catalog GTIN match',
      },
    ];

    const orders: TraceabilityOrderInput[] = [
      {
        id: 'ord-match',
        externalOrderId: 'ORD-101',
        pharmacyId: 'ph-1',
        placedAt: '2026-08-01T08:00:00Z',
        items: [{ productId: 'prod-amox', productName: 'Amoxicillin 500mg', requestedQty: 2 }],
        outcomes: [{ productId: 'prod-amox', filledQty: 2, cancelled: false }],
      },
      {
        id: 'ord-mismatch',
        externalOrderId: 'ORD-102',
        pharmacyId: 'ph-2',
        placedAt: '2026-08-01T09:00:00Z',
        items: [{ productId: 'prod-amox', productName: 'Amoxicillin 500mg', requestedQty: 3 }],
        outcomes: [{ productId: 'prod-amox', filledQty: 3, cancelled: false }],
      },
      {
        id: 'ord-no-trace',
        externalOrderId: 'ORD-103',
        pharmacyId: 'ph-3',
        placedAt: '2026-08-01T10:00:00Z',
        items: [{ productId: 'prod-para', productName: 'Paracetamol 500mg', requestedQty: 5 }],
        outcomes: [{ productId: 'prod-para', filledQty: 5, cancelled: false }],
      },
    ];

    const events: CanonicalTraceabilityEventRecord[] = [
      // 2 units shipped for ORD-101 (Exact match with operational filled_qty 2)
      {
        eventType: 'SHIPPING',
        eventTime: '2026-08-01T12:00:00Z',
        epc: '(01)06221234567891(21)SN101-1',
        gtin: '06221234567891',
        serial: 'SN101-1',
        readPointGln: '6221234567891',
        bizLocationGln: '6221234567891',
        bizTransactionRef: 'ORD-101',
        sourceFormat: 'XML_BARE',
        sourceIndex: 1,
      },
      {
        eventType: 'SHIPPING',
        eventTime: '2026-08-01T12:00:00Z',
        epc: '(01)06221234567891(21)SN101-2',
        gtin: '06221234567891',
        serial: 'SN101-2',
        readPointGln: '6221234567891',
        bizLocationGln: '6221234567891',
        bizTransactionRef: 'ORD-101',
        sourceFormat: 'XML_BARE',
        sourceIndex: 2,
      },
      // 1 unit shipped for ORD-102 (Discrepancy: operational filled_qty was 3, serialized shipped is 1)
      {
        eventType: 'SHIPPING',
        eventTime: '2026-08-01T12:00:00Z',
        epc: '(01)06221234567891(21)SN102-1',
        gtin: '06221234567891',
        serial: 'SN102-1',
        readPointGln: '6221234567891',
        bizLocationGln: '6221234567891',
        bizTransactionRef: 'ORD-102',
        sourceFormat: 'XML_BARE',
        sourceIndex: 3,
      },
    ];

    const results = reconcileOrdersWithTraceability(datasetId, orders, events, productLinks);
    expect(results).toHaveLength(3);

    const matchRec = results.find((r) => r.orderId === 'ord-match');
    expect(matchRec?.reconciliationStatus).toBe('MATCH');
    expect(matchRec?.operationalQty).toBe(2);
    expect(matchRec?.traceabilityQty).toBe(2);
    expect(matchRec?.differenceQty).toBe(0);

    const mismatchRec = results.find((r) => r.orderId === 'ord-mismatch');
    expect(mismatchRec?.reconciliationStatus).toBe('MISMATCH');
    expect(mismatchRec?.operationalQty).toBe(3);
    expect(mismatchRec?.traceabilityQty).toBe(1);
    expect(mismatchRec?.differenceQty).toBe(-2);

    const noTraceRec = results.find((r) => r.orderId === 'ord-no-trace');
    expect(noTraceRec?.reconciliationStatus).toBe('INSUFFICIENT_TRACEABILITY_DATA');
  });
});
