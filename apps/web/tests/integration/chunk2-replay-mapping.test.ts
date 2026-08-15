import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDataset } from '../../lib/db/repositories/datasets';
import { createPharmacy } from '../../lib/db/repositories/pharmacies';
import { createProduct } from '../../lib/db/repositories/products';
import { createSupplier } from '../../lib/db/repositories/suppliers';
import { createOrder, createOrderItem } from '../../lib/db/repositories/orders';
import { createSupplierOffer } from '../../lib/db/repositories/offers';
import { createOrderOutcome } from '../../lib/db/repositories/outcomes';
import { createAiDecision } from '../../lib/db/repositories/decisions';
import { initializeImport, processStoredImport } from '../../lib/imports/service';
import { IMPORT_BUCKET } from '../../lib/imports/storage';
import { getSupabaseServerClient } from '../../lib/supabase/server';
import { getDecisionReplay } from '../../lib/decisions/service';

describe('Database Integration — Chunk 2: Flexible Mapping & Decision Replay', () => {
  const datasetIds: string[] = [];
  const storagePaths = new Set<string>();
  let datasetId: string;
  let isolatedDatasetId: string;

  beforeAll(async () => {
    requireHostedEnvironment();
    const dataset = await createDataset({
      name: `Chunk 2 Integration ${randomUUID()}`,
      mode: 'IMPORTED_REAL',
    });
    const isolated = await createDataset({
      name: `Chunk 2 Isolation ${randomUUID()}`,
      mode: 'SAMPLE',
    });
    datasetId = dataset.id;
    isolatedDatasetId = isolated.id;
    datasetIds.push(datasetId, isolatedDatasetId);
  }, 30_000);

  afterAll(async () => {
    const supabase = getSupabaseServerClient();
    if (storagePaths.size > 0) {
      const { error } = await supabase.storage.from(IMPORT_BUCKET).remove([...storagePaths]);
      if (error) throw error;
    }
    const childTables = [
      'ai_decision_candidates',
      'ai_decisions',
      'order_outcomes',
      'supplier_offers',
      'order_items',
      'orders',
      'products',
      'pharmacies',
      'suppliers',
      'ingestion_jobs',
      'data_sources',
    ] as const;
    for (const id of datasetIds) {
      for (const table of childTables) {
        const { error } = await supabase.from(table).delete().eq('dataset_id', id);
        if (error) throw error;
      }
      const { error } = await supabase.from('datasets').delete().eq('id', id);
      if (error) throw error;
    }
  }, 60_000);

  it('imports a non-canonical header CSV using flexible column mapping into canonical Supabase tables', async () => {
    const nonCanonicalCsvContent = [
      'vendor_order_ref,pharm_code,pharm_title,date_placed,sku_number,drug_title,brand,qty_requested,packaging',
      'ORD-CH2-001,PHARM-CH2,Alpha Care,2026-08-10T10:00:00Z,PROD-CH2-1,Augmentin 1g,GSK,25,pack',
    ].join('\r\n');

    const mapping = {
      vendor_order_ref: 'order_id',
      pharm_code: 'pharmacy_id',
      pharm_title: 'pharmacy_name',
      date_placed: 'placed_at',
      sku_number: 'product_id',
      drug_title: 'product_name',
      brand: 'manufacturer',
      qty_requested: 'requested_qty',
      packaging: 'unit',
    };

    const filename = `mapped-orders-${randomUUID()}.csv`;
    const bytes = new TextEncoder().encode(nonCanonicalCsvContent);

    const initialized = await initializeImport({
      datasetId,
      kind: 'ORDERS',
      filename,
      size: bytes.byteLength,
      contentType: 'text/csv',
    });

    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', new Blob([bytes], { type: 'text/csv' }), filename);
    const uploadRes = await fetch(initialized.signedUrl, {
      method: 'PUT',
      headers: { 'x-upsert': 'false' },
      body,
    });
    expect(uploadRes.ok).toBe(true);
    storagePaths.add(initialized.storagePath);

    const result = await processStoredImport(initialized.jobId, mapping);
    expect(result.state).toBe('SUCCESS');
    expect(result.acceptedRows).toBe(1);
    expect(result.rejectedRows).toBe(0);

    const supabase = getSupabaseServerClient();
    const order = await supabase
      .from('orders')
      .select('*, pharmacies(external_pharmacy_id, name), order_items(*, products(external_product_id, name))')
      .eq('dataset_id', datasetId)
      .eq('external_order_id', 'ORD-CH2-001')
      .single();

    expect(order.error).toBeNull();
    expect(order.data?.external_order_id).toBe('ORD-CH2-001');
    expect(order.data?.pharmacies?.name).toBe('Alpha Care');
    expect(order.data?.order_items?.[0]?.requested_qty).toBe(25);
    expect(order.data?.order_items?.[0]?.products?.name).toBe('Augmentin 1g');
  }, 60_000);

  it('reconstructs decision replay at decision timestamp with strict temporal filtering and multi-item feasibility', async () => {
    // 1. Setup entities in dataset
    const pharmacy = await createPharmacy({
      dataset_id: datasetId,
      external_pharmacy_id: `PH-${randomUUID().slice(0, 6)}`,
      name: 'Replay Test Pharmacy',
    });
    const productA = await createProduct({
      dataset_id: datasetId,
      external_product_id: `SKU-A-${randomUUID().slice(0, 6)}`,
      name: 'Cataflam 50mg',
    });
    const productB = await createProduct({
      dataset_id: datasetId,
      external_product_id: `SKU-B-${randomUUID().slice(0, 6)}`,
      name: 'Panadol 500mg',
    });

    const supplierAlpha = await createSupplier({
      dataset_id: datasetId,
      external_supplier_id: `SUPP-ALPHA-${randomUUID().slice(0, 6)}`,
      name: 'Alpha Wholesaler',
    });
    const supplierBeta = await createSupplier({
      dataset_id: datasetId,
      external_supplier_id: `SUPP-BETA-${randomUUID().slice(0, 6)}`,
      name: 'Beta Pharma Distribution',
    });

    // 2. Create Multi-item Order (50x ProductA, 30x ProductB)
    const order = await createOrder({
      dataset_id: datasetId,
      external_order_id: `ORD-MULTI-${randomUUID().slice(0, 6)}`,
      pharmacy_id: pharmacy.id,
      status: 'IMPORTED',
      placed_at: '2026-08-10T08:00:00Z',
    });
    await createOrderItem({
      dataset_id: datasetId,
      order_id: order.id,
      product_id: productA.id,
      requested_qty: 50,
      unit: 'pack',
    });
    await createOrderItem({
      dataset_id: datasetId,
      order_id: order.id,
      product_id: productB.id,
      requested_qty: 30,
      unit: 'pack',
    });

    // 3. Create Decision at 2026-08-10T12:00:00Z choosing Alpha
    const decidedAt = '2026-08-10T12:00:00Z';
    const decision = await createAiDecision({
      dataset_id: datasetId,
      external_decision_id: `DEC-TEST-${randomUUID().slice(0, 6)}`,
      order_id: order.id,
      selected_supplier_id: supplierAlpha.id,
      decided_at: decidedAt,
      agent_name: 'ProcureReplayAgent',
      agent_version: '2.0.0',
      confidence: 0.92,
      selection_reason: 'Fastest available quote',
    });

    // 4. Supplier Alpha offers (Before decision: ProductA 50 units @ 10.00 EGP, ProductB 30 units @ 5.00 EGP) -> Total = 650.00 EGP
    await createSupplierOffer({
      dataset_id: datasetId,
      external_offer_id: `OFF-A1-${randomUUID().slice(0, 6)}`,
      order_id: order.id,
      supplier_id: supplierAlpha.id,
      product_id: productA.id,
      available_qty: 50,
      unit_price_minor: 1000n,
      discount_bps: 0,
      promised_delivery_at: '2026-08-10T18:00:00Z',
      offered_at: '2026-08-10T10:00:00Z', // valid decision time
    });
    await createSupplierOffer({
      dataset_id: datasetId,
      external_offer_id: `OFF-A2-${randomUUID().slice(0, 6)}`,
      order_id: order.id,
      supplier_id: supplierAlpha.id,
      product_id: productB.id,
      available_qty: 30,
      unit_price_minor: 500n,
      discount_bps: 0,
      promised_delivery_at: '2026-08-10T18:00:00Z',
      offered_at: '2026-08-10T10:00:00Z', // valid decision time
    });

    // 5. Supplier Beta offers (Before decision: ProductA 50 units @ 9.00 EGP, ProductB 30 units @ 4.50 EGP, promised 16:00) -> Total = 585.00 EGP (Cheaper AND Faster -> Dominates Alpha!)
    await createSupplierOffer({
      dataset_id: datasetId,
      external_offer_id: `OFF-B1-${randomUUID().slice(0, 6)}`,
      order_id: order.id,
      supplier_id: supplierBeta.id,
      product_id: productA.id,
      available_qty: 50,
      unit_price_minor: 900n,
      discount_bps: 0,
      promised_delivery_at: '2026-08-10T16:00:00Z',
      offered_at: '2026-08-10T10:30:00Z',
    });
    await createSupplierOffer({
      dataset_id: datasetId,
      external_offer_id: `OFF-B2-${randomUUID().slice(0, 6)}`,
      order_id: order.id,
      supplier_id: supplierBeta.id,
      product_id: productB.id,
      available_qty: 30,
      unit_price_minor: 450n,
      discount_bps: 0,
      promised_delivery_at: '2026-08-10T16:00:00Z',
      offered_at: '2026-08-10T10:30:00Z',
    });

    // 6. Future Offer from a third supplier (after decided_at) -> MUST BE STRICTLY EXCLUDED!
    const supplierGamma = await createSupplier({
      dataset_id: datasetId,
      external_supplier_id: `SUPP-GAMMA-${randomUUID().slice(0, 6)}`,
      name: 'Gamma Future Supplier',
    });
    await createSupplierOffer({
      dataset_id: datasetId,
      external_offer_id: `OFF-G1-${randomUUID().slice(0, 6)}`,
      order_id: order.id,
      supplier_id: supplierGamma.id,
      product_id: productA.id,
      available_qty: 100,
      unit_price_minor: 100n,
      discount_bps: 0,
      offered_at: '2026-08-10T14:00:00Z', // AFTER decision!
    });

    // 7. Outcome for Alpha
    await createOrderOutcome({
      dataset_id: datasetId,
      order_id: order.id,
      supplier_id: supplierAlpha.id,
      product_id: productA.id,
      filled_qty: 50,
      delivered_at: '2026-08-10T18:00:00Z',
      cancelled: false,
      outcome_final: true,
    });

    // 8. Run Decision Replay on hosted Supabase
    const replay = await getDecisionReplay(datasetId, decision.id);
    expect(replay).not.toBeNull();
    expect(replay?.classification).toBe('DOMINATED');
    expect(replay?.dominatingSupplier?.supplierId).toBe(supplierBeta.id);
    expect(replay?.futureOffersExcludedCount).toBe(1);
    expect(replay?.consideredOffersCount).toBe(4);
    expect(replay?.candidates.some((c) => c.supplierId === supplierGamma.id)).toBe(false);

    // 9. Dataset Isolation: Replay should return null in another dataset
    const isolatedReplay = await getDecisionReplay(isolatedDatasetId, decision.id);
    expect(isolatedReplay).toBeNull();
  }, 60_000);
});

function requireHostedEnvironment(): void {
  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required. Hosted DB tests MUST NOT skip silently.');
  }
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required.');
  }
}
