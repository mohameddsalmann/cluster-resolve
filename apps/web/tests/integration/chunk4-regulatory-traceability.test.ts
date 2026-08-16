import { beforeAll, describe, expect, it } from 'vitest';
import { fetchEdaNotices, runEpttsPreflight } from '@cluster/core';
import { createDataset } from '../../lib/db/repositories/datasets';
import {
  evaluateAndPersistExposures,
  listRegulatoryExposures,
  listRegulatoryNotices,
  upsertRegulatoryNotices,
} from '../../lib/db/repositories/regulatory';
import {
  createTraceabilityImport,
  evaluateAndPersistReconciliations,
  getExpiryIntelligenceSummary,
  listCanonicalEvents,
  listTraceabilityProductLinks,
  listTraceabilityReconciliations,
  persistCanonicalEvents,
  upsertTraceabilityProductLink,
} from '../../lib/db/repositories/traceability';
import { getSupabaseServerClient } from '../../lib/supabase/server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Chunk 4 Integration — Regulatory Intelligence & EPTTS Traceability', () => {
  let datasetId: string;
  let amoxProductId: string;
  let testOrderId: string;

  beforeAll(async () => {
    const dataset = await createDataset({
      name: `Chunk 4 Integration Test ${Date.now()}`,
      mode: 'SAMPLE',
      description: 'Automated integration testing for regulatory and traceability workflows',
    });
    datasetId = dataset.id;

    const supabase = getSupabaseServerClient();

    // Seed test pharmacy and supplier
    const [pharmRes, suppRes] = await Promise.all([
      supabase.from('pharmacies').insert({
        dataset_id: datasetId,
        external_pharmacy_id: 'PHARM-CH4-01',
        name: 'El-Ezaby Heliopolis Test',
      }).select('id').single(),
      supabase.from('suppliers').insert({
        dataset_id: datasetId,
        external_supplier_id: 'SUPP-CH4-01',
        name: 'Ramco Pharma Test',
        name_normalized: 'ramco pharma test',
      }).select('id').single(),
    ]);

    if (pharmRes.error) throw pharmRes.error;
    if (suppRes.error) throw suppRes.error;

    // Seed test product
    const { data: prod, error: prodErr } = await supabase.from('products').insert({
      dataset_id: datasetId,
      external_product_id: '06221234567891',
      name: 'Amoxicillin 500mg Test Capsules',
      name_normalized: 'amoxicillin 500mg test capsules',
    }).select('id').single();

    if (prodErr) throw prodErr;
    amoxProductId = prod!.id;

    // Seed test order
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      dataset_id: datasetId,
      external_order_id: 'ORD-CH4-001',
      pharmacy_id: pharmRes.data!.id,
      status: 'IMPORTED',
      placed_at: '2026-08-01T10:00:00Z',
    }).select('id').single();

    if (orderErr) throw orderErr;
    testOrderId = order!.id;

    const [itemRes, offRes, outRes] = await Promise.all([
      supabase.from('order_items').insert({
        dataset_id: datasetId,
        order_id: testOrderId,
        product_id: amoxProductId,
        requested_qty: 10,
        unit: 'pack',
      }),
      supabase.from('supplier_offers').insert({
        dataset_id: datasetId,
        external_offer_id: 'OFFER-CH4-001',
        order_id: testOrderId,
        supplier_id: suppRes.data!.id,
        product_id: amoxProductId,
        available_qty: 10,
        unit_price_minor: 2500, // 25.00 EGP
        discount_bps: 0,
        offered_at: '2026-08-01T10:30:00Z',
        promised_delivery_at: '2026-08-02T10:00:00Z',
      }),
      supabase.from('order_outcomes').insert({
        dataset_id: datasetId,
        order_id: testOrderId,
        supplier_id: suppRes.data!.id,
        product_id: amoxProductId,
        filled_qty: 10,
        cancelled: false,
        outcome_final: true,
      }),
    ]);

    if (itemRes.error) throw itemRes.error;
    if (offRes.error) throw offRes.error;
    if (outRes.error) throw outRes.error;
  }, 60_000);

  it('ingests official EDA notices and deterministically calculates dataset exposures', async () => {
    // 1. Ingest notices
    const { notices } = await fetchEdaNotices({ allowLive: false });
    expect(notices.length).toBeGreaterThanOrEqual(10);

    const persisted = await upsertRegulatoryNotices(notices);
    expect(persisted.length).toBeGreaterThanOrEqual(10);
    expect(persisted.every((notice) => UUID_PATTERN.test(notice.id))).toBe(true);

    const { notices: list, totalCount } = await listRegulatoryNotices({ limit: 10 });
    expect(totalCount).toBeGreaterThanOrEqual(10);
    expect(list[0]).toHaveProperty('notice_number');

    // 2. Evaluate dataset exposures
    const summary = await evaluateAndPersistExposures(datasetId);
    expect(summary.totalNoticesEvaluated).toBe(totalCount);

    const exposures = await listRegulatoryExposures(datasetId);
    expect(exposures.length).toBe(totalCount);
    expect(exposures.every((exposure) => UUID_PATTERN.test(exposure.id))).toBe(true);
  }, 60_000);

  it('runs EPTTS CSV preflight, records import, persists events, and reconciles orders', async () => {
    const validCsv = [
      'seqNo,Bizstep,eventTime,timeOffset,readPointGLN,bizLocationGLN,epc,Parent,import,expiryDate,manufDate',
      '1,commissioning,2026-08-01T08:00:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN001,(10)BATCH-A,0,2028-12-31,2026-07-01',
      '2,commissioning,2026-08-01T08:05:00Z,+02:00,6221234567891,6221234567891,(01)06221234567891(21)SN002,(10)BATCH-A,0,2028-12-31,2026-07-01',
    ].join('\n');

    // 1. Run Preflight
    const { result, canonicalEvents } = runEpttsPreflight(validCsv, 'CSV', 'test_commissioning.csv');
    expect(result.status).toBe('PASS');
    expect(canonicalEvents).toHaveLength(2);

    // 2. Persist Import
    const { importRow, findings } = await createTraceabilityImport({
      datasetId,
      filename: 'test_commissioning.csv',
      format: 'CSV',
      storagePath: `${datasetId}/test_commissioning.csv`,
      fileSha256: `sha256_mock_${Date.now()}`,
      fileSizeBytes: validCsv.length,
      result,
    });

    expect(importRow.preflight_status).toBe('PASS');
    expect(importRow.id).toMatch(UUID_PATTERN);
    expect(findings).toHaveLength(0);

    // 3. Persist Canonical Events
    const events = await persistCanonicalEvents(datasetId, importRow.id, canonicalEvents);
    expect(events).toHaveLength(2);
    expect(events.every((event) => UUID_PATTERN.test(event.id))).toBe(true);

    const eventList = await listCanonicalEvents(datasetId);
    expect(eventList.totalCount).toBe(2);

    // 4. Confirm GTIN link
    await upsertTraceabilityProductLink(
      datasetId,
      amoxProductId,
      '06221234567891',
      'CONFIRMED',
      'Integration test direct link'
    );

    const links = await listTraceabilityProductLinks(datasetId);
    expect(links.some((l) => l.gtin === '06221234567891' && l.status === 'CONFIRMED')).toBe(true);
    expect(links.every((link) => UUID_PATTERN.test(link.id))).toBe(true);

    // 5. Expiry Intelligence
    const expiryData = await getExpiryIntelligenceSummary(datasetId);
    expect(expiryData.summary.totalSerializedUnits).toBe(2);
    expect(expiryData.summary.laterCount).toBe(2);

    // 6. Reconciliation
    const reconciliations = await evaluateAndPersistReconciliations(datasetId);
    expect(reconciliations.length).toBeGreaterThanOrEqual(1);
    expect(reconciliations.every((item) => UUID_PATTERN.test(item.id))).toBe(true);

    const reconsList = await listTraceabilityReconciliations(datasetId);
    expect(reconsList.length).toBeGreaterThanOrEqual(1);
  }, 60_000);
});
