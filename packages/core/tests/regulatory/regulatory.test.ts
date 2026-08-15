import { describe, expect, it } from 'vitest';
import {
  cleanHtmlText,
  fetchEdaNotices,
  parseEdaTableHtml,
  parseNoticeType,
  parseRecallClass,
} from '../../src/regulatory/eda-fetcher';
import {
  determineNoticeMatch,
  evaluateRegulatoryExposures,
} from '../../src/regulatory/matcher';
import type {
  ProcurementOrderRecord,
  ProcurementProductRecord,
  RegulatoryNoticeSource,
} from '../../src/regulatory/types';

describe('Regulatory Module — EDA Notice Ingestion & Parser', () => {
  it('parses recall classes correctly', () => {
    expect(parseRecallClass('I')).toBe('CLASS_I');
    expect(parseRecallClass('Class II')).toBe('CLASS_II');
    expect(parseRecallClass('III')).toBe('CLASS_III');
    expect(parseRecallClass('-')).toBeNull();
    expect(parseRecallClass('')).toBeNull();
  });

  it('parses notice types accurately', () => {
    expect(parseNoticeType('Recall', 'CLASS_II')).toBe('RECALL');
    expect(parseNoticeType('commercial fraud', null)).toBe('COMMERCIAL_FRAUD');
    expect(parseNoticeType('Alerts Notice Letters', null)).toBe('ALERT');
    expect(parseNoticeType('توعية', null)).toBe('AWARENESS');
  });

  it('cleans HTML text and extracts report tables', () => {
    const sampleHtml = `
      <table>
        <tr><th>Class</th><th>Report</th><th>Type</th><th>Product</th></tr>
        <tr>
          <td>II</td>
          <td><a href="/media/123/diclac.pdf">Periodic report no.(1) For 2026</a></td>
          <td>Recall</td>
          <td>Diclac Ampoule 75mg<br />Solution for Injection</td>
        </tr>
        <tr>
          <td>-</td>
          <td><a href="/media/456/cialis.pdf">Periodic report no.(24) For 2026</a></td>
          <td>Alerts Notice Letters</td>
          <td>Cialis 20 MG &nbsp;</td>
        </tr>
      </table>
    `;

    const parsed = parseEdaTableHtml(sampleHtml, 2026);
    expect(parsed).toHaveLength(2);

    expect(parsed[0]).toMatchObject({
      noticeNumber: 'Periodic report no.(1) For 2026',
      year: 2026,
      noticeType: 'RECALL',
      recallClass: 'CLASS_II',
      productName: 'Diclac Ampoule 75mg Solution for Injection',
      sourceUrl: 'https://www.edaegypt.gov.eg/media/123/diclac.pdf',
    });
    expect(parsed[0].sourceChecksum).toBeDefined();

    expect(parsed[1]).toMatchObject({
      noticeNumber: 'Periodic report no.(24) For 2026',
      year: 2026,
      noticeType: 'ALERT',
      recallClass: null,
      productName: 'Cialis 20 MG',
      sourceUrl: 'https://www.edaegypt.gov.eg/media/456/cialis.pdf',
    });
  });

  it('fetches offline reference cache when live is disabled', async () => {
    const res = await fetchEdaNotices({ allowLive: false });
    expect(res.source).toBe('REFERENCE_CACHE');
    expect(res.notices.length).toBeGreaterThanOrEqual(15);

    const emoxclav = res.notices.find((n) => n.noticeNumber.includes('15') && n.year === 2026);
    expect(emoxclav).toBeDefined();
    expect(emoxclav?.productName).toContain('E-moxclav');
    expect(emoxclav?.recallClass).toBe('CLASS_II');
  });
});

describe('Regulatory Module — Deterministic Exposure Matcher', () => {
  const products: ProcurementProductRecord[] = [
    {
      id: 'prod-amox',
      name: 'Amoxicillin 500mg Capsules (16s)',
      nameNormalized: 'amoxicillin 500mg capsules 16s',
      gtin: '06221234000101',
    },
    {
      id: 'prod-para',
      name: 'Paracetamol 500mg Tablets (20s)',
      nameNormalized: 'paracetamol 500mg tablets 20s',
      gtin: '06221234000200',
    },
    {
      id: 'prod-ator',
      name: 'Atorvastatin 20mg Tablets (28s)',
      nameNormalized: 'atorvastatin 20mg tablets 28s',
    },
  ];

  const orders: ProcurementOrderRecord[] = [
    {
      id: 'ord-1',
      externalOrderId: 'ORD-2026-001',
      pharmacyId: 'pharm-1',
      placedAt: '2026-08-01T10:00:00Z',
      items: [{ productId: 'prod-amox', requestedQty: 100 }],
      offers: [{ supplierId: 'supp-1', productId: 'prod-amox', unitPriceMinor: 2500n }], // 25.00 EGP
      outcomes: [{ supplierId: 'supp-1', productId: 'prod-amox', filledQty: 100, cancelled: false }],
    },
    {
      id: 'ord-2',
      externalOrderId: 'ORD-2026-002',
      pharmacyId: 'pharm-2',
      placedAt: '2026-08-02T11:00:00Z',
      items: [{ productId: 'prod-amox', requestedQty: 50 }],
      offers: [{ supplierId: 'supp-2', productId: 'prod-amox', unitPriceMinor: 2500n }],
      outcomes: [{ supplierId: 'supp-2', productId: 'prod-amox', filledQty: 40, cancelled: false }],
    },
    {
      id: 'ord-3',
      externalOrderId: 'ORD-2026-003',
      pharmacyId: 'pharm-1',
      placedAt: '2026-08-03T12:00:00Z',
      items: [{ productId: 'prod-para', requestedQty: 200 }],
      offers: [{ supplierId: 'supp-1', productId: 'prod-para', unitPriceMinor: 1000n }], // 10.00 EGP
      outcomes: [{ supplierId: 'supp-1', productId: 'prod-para', filledQty: 200, cancelled: false }],
    },
  ];

  it('matches notices with EXACT, POSSIBLE, and UNMATCHED status', () => {
    const exactNotice: RegulatoryNoticeSource = {
      noticeNumber: 'Report 1',
      title: 'Amoxicillin Recall',
      year: 2025,
      noticeType: 'RECALL',
      recallClass: 'CLASS_II',
      productName: 'Amoxicillin 500mg',
      manufacturer: 'MUP',
      batchNumbers: ['AM2501'],
      registrationNumber: '06221234000101', // GTIN match
      reason: 'Stability failure',
      sourceUrl: 'https://edaegypt.gov.eg/media/1.pdf',
      sourceAuthority: 'Egyptian Drug Authority',
      sourceDocCode: null,
      sourceVersion: null,
    };

    const possibleNotice: RegulatoryNoticeSource = {
      noticeNumber: 'Report 12',
      title: 'Paracetamol Alert',
      year: 2025,
      noticeType: 'ALERT',
      recallClass: null,
      productName: 'Paracetamol 500mg Tablets',
      manufacturer: 'Misr',
      batchNumbers: ['PC2512'],
      registrationNumber: null,
      reason: 'Packaging variation',
      sourceUrl: 'https://edaegypt.gov.eg/media/12.pdf',
      sourceAuthority: 'Egyptian Drug Authority',
      sourceDocCode: null,
      sourceVersion: null,
    };

    const unmatchedNotice: RegulatoryNoticeSource = {
      noticeNumber: 'Report 50',
      title: 'Unrelated Ointment Recall',
      year: 2026,
      noticeType: 'RECALL',
      recallClass: 'CLASS_III',
      productName: 'Ketoconazole 2% Topical Cream',
      manufacturer: 'Pharma Co',
      batchNumbers: ['KC2650'],
      registrationNumber: null,
      reason: 'Minor leak',
      sourceUrl: 'https://edaegypt.gov.eg/media/50.pdf',
      sourceAuthority: 'Egyptian Drug Authority',
      sourceDocCode: null,
      sourceVersion: null,
    };

    const match1 = determineNoticeMatch(exactNotice, products);
    expect(match1.matchStatus).toBe('EXACT');
    expect(match1.matchedProduct?.id).toBe('prod-amox');

    const match2 = determineNoticeMatch(possibleNotice, products);
    expect(match2.matchStatus).toBe('POSSIBLE');
    expect(match2.matchedProduct?.id).toBe('prod-para');

    const match3 = determineNoticeMatch(unmatchedNotice, products);
    expect(match3.matchStatus).toBe('UNMATCHED');
    expect(match3.matchedProduct).toBeNull();
  });

  it('evaluates dataset operational exposure and calculates piastre values accurately', () => {
    const notices: RegulatoryNoticeSource[] = [
      {
        noticeNumber: 'Report 1',
        title: 'Amoxicillin Recall',
        year: 2025,
        noticeType: 'RECALL',
        recallClass: 'CLASS_II',
        productName: 'Amoxicillin 500mg Capsules',
        manufacturer: 'MUP',
        batchNumbers: ['AM2501'],
        registrationNumber: '06221234000101',
        reason: 'Stability failure',
        sourceUrl: 'https://edaegypt.gov.eg/media/1.pdf',
        sourceAuthority: 'Egyptian Drug Authority',
        sourceDocCode: null,
        sourceVersion: null,
      },
      {
        noticeNumber: 'Report 99',
        title: 'Unmatched Notice',
        year: 2026,
        noticeType: 'RECALL',
        recallClass: 'CLASS_I',
        productName: 'Vancocin 500mg IV',
        manufacturer: 'Lilly',
        batchNumbers: [],
        registrationNumber: null,
        reason: 'Contamination',
        sourceUrl: 'https://edaegypt.gov.eg/media/99.pdf',
        sourceAuthority: 'Egyptian Drug Authority',
        sourceDocCode: null,
        sourceVersion: null,
      },
    ];

    const summary = evaluateRegulatoryExposures('dataset-test-1', notices, products, orders);

    expect(summary.totalNoticesEvaluated).toBe(2);
    expect(summary.exactMatchesCount).toBe(1);
    expect(summary.possibleMatchesCount).toBe(0);
    expect(summary.unmatchedCount).toBe(1);
    expect(summary.totalAffectedOrders).toBe(2); // ord-1 and ord-2

    const amoxExposure = summary.exposures.find((e) => e.noticeNumber === 'Report 1');
    expect(amoxExposure).toBeDefined();
    expect(amoxExposure?.affectedOrdersCount).toBe(2);
    expect(amoxExposure?.affectedPharmaciesCount).toBe(2); // pharm-1 and pharm-2
    expect(amoxExposure?.affectedSuppliersCount).toBe(2); // supp-1 and supp-2
    expect(amoxExposure?.requestedUnits).toBe(150); // 100 + 50
    expect(amoxExposure?.filledUnits).toBe(140); // 100 + 40

    // Value = (100 * 2500) + (40 * 2500) = 250,000 + 100,000 = 350,000 piastres (3,500.00 EGP)
    expect(amoxExposure?.historicalValueMinor).toBe(350_000n);
    expect(summary.totalExposedValueMinor).toBe(350_000n);

    // Unmatched exposure has 0 counts
    const unmatchedExposure = summary.exposures.find((e) => e.noticeNumber === 'Report 99');
    expect(unmatchedExposure?.affectedOrdersCount).toBe(0);
    expect(unmatchedExposure?.historicalValueMinor).toBe(0n);
  });
});
