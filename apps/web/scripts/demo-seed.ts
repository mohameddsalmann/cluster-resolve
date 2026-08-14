import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const envLocalPath = resolve(__dirname, '../.env.local');
if (existsSync(envLocalPath)) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(envLocalPath);
    } else {
      const content = readFileSync(envLocalPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const val = trimmed.slice(eq + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch {
    // ignore
  }
}

import { getSupabaseServerClient } from '../lib/supabase/server';
import { createDataset, listDatasets } from '../lib/db/repositories/datasets';
import { evaluateDatasetOperations } from '../lib/operations/evaluate';
import type { Database } from '../lib/db/generated-types';

type PublicTables = Database['public']['Tables'];

const DEMO_DATASET_NAME = 'Demo Cairo Operations (SAMPLE)';
const AS_OF_DATE = '2026-08-14T00:00:00.000Z';

export async function seedDemoDataset(): Promise<string> {
  const supabase = getSupabaseServerClient();
  const existingDatasets = await listDatasets();
  const existing = existingDatasets.find((d) => d.name === DEMO_DATASET_NAME && d.mode === 'SAMPLE');

  let datasetId: string;

  if (existing) {
    console.log(`[demo:seed] Found existing SAMPLE dataset: ${existing.id} (${existing.name})`);
    datasetId = existing.id;
    // Check if data is already populated
    const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId);
    if (count && count > 0) {
      console.log(`[demo:seed] Dataset already has ${count} orders. Running evaluation...`);
      const summary = await evaluateDatasetOperations(datasetId, AS_OF_DATE);
      console.log(`[demo:seed] Evaluated: ${summary.exceptionsPersisted} exceptions, ${summary.suppliersEvaluated} suppliers.`);
      return datasetId;
    }
  } else {
    console.log(`[demo:seed] Creating dataset: ${DEMO_DATASET_NAME}`);
    const created = await createDataset({
      name: DEMO_DATASET_NAME,
      mode: 'SAMPLE',
      description: 'Persistent deterministic founder demo dataset with healthy & deteriorating suppliers and order exceptions.',
    });
    datasetId = created.id;
  }

  console.log(`[demo:seed] Populating canonical records for dataset ${datasetId}...`);

  // 1. Pharmacies
  const pharmacies = await insertMany('pharmacies', [
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-CAIRO-01', name: 'Nile Pharmacy · Cairo' },
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-CAIRO-02', name: 'Zamalek Care Pharmacy' },
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-MAADI-03', name: 'Maadi Health Pharmacy' },
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-ALEX-04', name: 'Alexandria Pharma Hub' },
  ]);
  const pharmMap = new Map(pharmacies.map((p) => [p.external_pharmacy_id, p.id]));

  // 2. Products
  const products = await insertMany('products', [
    { dataset_id: datasetId, external_product_id: 'PROD-PARA-500', name: 'Paracetamol 500mg Tablets (20s)', name_normalized: 'paracetamol 500mg tablets 20s' },
    { dataset_id: datasetId, external_product_id: 'PROD-AMOX-500', name: 'Amoxicillin 500mg Capsules (16s)', name_normalized: 'amoxicillin 500mg capsules 16s' },
    { dataset_id: datasetId, external_product_id: 'PROD-OMEP-20', name: 'Omeprazole 20mg Delayed-Release (14s)', name_normalized: 'omeprazole 20mg delayed-release 14s' },
    { dataset_id: datasetId, external_product_id: 'PROD-METF-850', name: 'Metformin 850mg Tablets (30s)', name_normalized: 'metformin 850mg tablets 30s' },
  ]);
  const prodMap = new Map(products.map((p) => [p.external_product_id, p.id]));

  // 3. Suppliers
  const suppliers = await insertMany('suppliers', [
    { dataset_id: datasetId, external_supplier_id: 'SUP-DEMO-01', name: 'Cairo Medical Supply', name_normalized: 'cairo medical supply' },
    { dataset_id: datasetId, external_supplier_id: 'SUP-DEMO-02', name: 'Horus Distribution', name_normalized: 'horus distribution' },
    { dataset_id: datasetId, external_supplier_id: 'SUP-DEMO-03', name: 'Delta Wholesale', name_normalized: 'delta wholesale' },
    { dataset_id: datasetId, external_supplier_id: 'SUP-DEMO-04', name: 'Upper Egypt Pharma', name_normalized: 'upper egypt pharma' },
  ]);
  const suppMap = new Map(suppliers.map((s) => [s.external_supplier_id, s.id]));

  // 4. Scenario orders
  const baselineDates = Array.from({ length: 20 }, (_, i) => `2026-07-${String(i + 5).padStart(2, '0')}T09:00:00.000Z`);
  const recentDates = Array.from({ length: 10 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`);

  interface OrderSpec {
    extId: string;
    pharmExtId: string;
    prodExtId: string;
    suppExtId: string;
    placedAt: string;
    requestedQty: number;
    filledQty: number;
    deliveredAt: string | null;
    cancelled: boolean;
    cancellationReason?: string | null;
    unitPrice: string;
    discountBps: number;
  }

  const orderSpecs: OrderSpec[] = [];

  // SUP-01 Healthy Baseline (20) & Recent (10)
  baselineDates.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-SUP1-B-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-CAIRO-01',
      prodExtId: 'PROD-PARA-500',
      suppExtId: 'SUP-DEMO-01',
      placedAt: placed,
      requestedQty: 50,
      filledQty: 50,
      deliveredAt: addHours(placed, 24),
      cancelled: false,
      unitPrice: '1700',
      discountBps: 500,
    });
  });

  recentDates.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-SUP1-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-CAIRO-01',
      prodExtId: 'PROD-PARA-500',
      suppExtId: 'SUP-DEMO-01',
      placedAt: placed,
      requestedQty: 50,
      filledQty: 50,
      deliveredAt: addHours(placed, 24),
      cancelled: false,
      unitPrice: '1700',
      discountBps: 500,
    });
  });

  // SUP-02 Deteriorating Baseline (20 healthy)
  baselineDates.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-SUP2-B-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-CAIRO-02',
      prodExtId: 'PROD-AMOX-500',
      suppExtId: 'SUP-DEMO-02',
      placedAt: placed,
      requestedQty: 40,
      filledQty: 40,
      deliveredAt: addHours(placed, 20),
      cancelled: false,
      unitPrice: '2500',
      discountBps: 200,
    });
  });

  // SUP-02 Deteriorating Recent (10 with partials, cancellations, lateness)
  recentDates.forEach((placed, i) => {
    const isPartial = i === 6 || i === 7; // ORD-DEMO-1002
    const isCancelled = i === 9; // ORD-DEMO-1004
    const isUnfulfilled = i === 8;
    const isLate = i === 0 || i === 1;

    let filled = 40;
    let delivered: string | null = addHours(placed, 20);

    if (isPartial) {
      filled = 24;
      delivered = addHours(placed, 48);
    } else if (isCancelled) {
      filled = 0;
      delivered = null;
    } else if (isUnfulfilled) {
      filled = 0;
      delivered = null;
    } else if (isLate) {
      filled = 40;
      delivered = addHours(placed, 60); // promised 24h, delivered in 60h
    }

    orderSpecs.push({
      extId: i === 6 ? 'ORD-DEMO-1002' : i === 9 ? 'ORD-DEMO-1004' : `ORD-SUP2-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-CAIRO-02',
      prodExtId: 'PROD-AMOX-500',
      suppExtId: 'SUP-DEMO-02',
      placedAt: placed,
      requestedQty: 40,
      filledQty: filled,
      deliveredAt: delivered,
      cancelled: isCancelled,
      cancellationReason: isCancelled ? 'Supplier stock unavailable.' : null,
      unitPrice: '2500',
      discountBps: 200,
    });
  });

  // SUP-03 Healthy (Baseline 20 + Recent 10)
  baselineDates.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-SUP3-B-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-MAADI-03',
      prodExtId: 'PROD-OMEP-20',
      suppExtId: 'SUP-DEMO-03',
      placedAt: placed,
      requestedQty: 30,
      filledQty: 30,
      deliveredAt: addHours(placed, 24),
      cancelled: false,
      unitPrice: '3200',
      discountBps: 300,
    });
  });

  recentDates.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-SUP3-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-MAADI-03',
      prodExtId: 'PROD-OMEP-20',
      suppExtId: 'SUP-DEMO-03',
      placedAt: placed,
      requestedQty: 30,
      filledQty: 30,
      deliveredAt: addHours(placed, 24),
      cancelled: false,
      unitPrice: '3200',
      discountBps: 300,
    });
  });

  // SUP-04 Low sample (2 orders)
  ['2026-08-10T11:00:00.000Z', '2026-08-11T11:00:00.000Z'].forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-SUP4-LOW-${i + 1}`,
      pharmExtId: 'PHARM-ALEX-04',
      prodExtId: 'PROD-METF-850',
      suppExtId: 'SUP-DEMO-04',
      placedAt: placed,
      requestedQty: 25,
      filledQty: 25,
      deliveredAt: addHours(placed, 18),
      cancelled: false,
      unitPrice: '1200',
      discountBps: 100,
    });
  });

  // Insert orders
  const orderRows = await insertMany(
    'orders',
    orderSpecs.map((s) => ({
      dataset_id: datasetId,
      external_order_id: s.extId,
      pharmacy_id: pharmMap.get(s.pharmExtId)!,
      status: 'IMPORTED',
      placed_at: s.placedAt,
    }))
  );
  const orderMap = new Map(orderRows.map((o) => [o.external_order_id, o.id]));

  // Insert order items
  await insertMany(
    'order_items',
    orderSpecs.map((s) => ({
      dataset_id: datasetId,
      order_id: orderMap.get(s.extId)!,
      product_id: prodMap.get(s.prodExtId)!,
      requested_qty: s.requestedQty,
      unit: 'pack',
    }))
  );

  // Insert offers
  await insertMany(
    'supplier_offers',
    orderSpecs.map((s) => ({
      dataset_id: datasetId,
      external_offer_id: `OFFER-${s.extId}`,
      order_id: orderMap.get(s.extId)!,
      supplier_id: suppMap.get(s.suppExtId)!,
      product_id: prodMap.get(s.prodExtId)!,
      available_qty: s.requestedQty,
      unit_price_minor: s.unitPrice,
      discount_bps: s.discountBps,
      promised_delivery_at: addHours(s.placedAt, 24),
      offered_at: addHours(s.placedAt, 1),
    })) as never
  );

  // Insert AI decisions
  await insertMany(
    'ai_decisions',
    orderSpecs.map((s) => ({
      dataset_id: datasetId,
      external_decision_id: `DEC-${s.extId}`,
      order_id: orderMap.get(s.extId)!,
      selected_supplier_id: suppMap.get(s.suppExtId)!,
      decided_at: addHours(s.placedAt, 2),
      selection_reason: `Automated selection based on lowest unit price and promised delivery.`,
    }))
  );

  // Insert outcomes
  await insertMany(
    'order_outcomes',
    orderSpecs.map((s) => ({
      dataset_id: datasetId,
      order_id: orderMap.get(s.extId)!,
      supplier_id: suppMap.get(s.suppExtId)!,
      product_id: prodMap.get(s.prodExtId)!,
      filled_qty: s.filledQty,
      delivered_at: s.deliveredAt,
      cancelled: s.cancelled,
      cancellation_reason: s.cancellationReason ?? null,
      outcome_final: true,
    }))
  );

  console.log(`[demo:seed] Inserted ${orderSpecs.length} orders and related entities.`);

  // Run Phase 4 evaluation
  console.log(`[demo:seed] Running Phase 4 evaluation on dataset ${datasetId}...`);
  const evalResult = await evaluateDatasetOperations(datasetId, AS_OF_DATE);
  console.log(
    `[demo:seed] Evaluation complete: ${evalResult.ordersLoaded} orders loaded, ${evalResult.exceptionsPersisted} exceptions persisted, ${evalResult.suppliersEvaluated} suppliers evaluated.`
  );
  console.log(`[demo:seed] Supplier statuses:`, evalResult.suppliersByStatus);

  return datasetId;

  async function insertMany<T extends keyof PublicTables>(
    table: T,
    values: Array<PublicTables[T]['Insert']>
  ): Promise<Array<PublicTables[T]['Row']>> {
    const { data, error } = await supabase.from(table as never).insert(values as never).select('*');
    if (error) throw error;
    return (data ?? []) as unknown as Array<PublicTables[T]['Row']>;
  }
}

function addHours(isoString: string, hours: number): string {
  return new Date(Date.parse(isoString) + hours * 3600_000).toISOString();
}

// Auto-run when executed directly
if (process.argv[1]?.includes('demo-seed')) {
  seedDemoDataset()
    .then((id) => {
      console.log(`[demo:seed] SUCCESS! Demo dataset ID: ${id}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[demo:seed] FAILED:', err);
      process.exit(1);
    });
}
