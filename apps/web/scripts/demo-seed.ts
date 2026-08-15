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

// ─────────────────────────────────────────────────────────────────────────────
// Chunk 3 Founder Demo — Cluster Resolve · Q3-2026
// 6 pharmacies, 8 products, 6 suppliers, ~300 engineered orders
// Scenarios: healthy, deteriorating, mixed per-product, promise-breaker,
//            pharmacy HIGH_RISK, pharmacy AT_RISK
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_DATASET_NAME = 'Cluster Resolve · Founder Demo (Q3-2026)';
const AS_OF_DATE = '2026-08-14T00:00:00.000Z';

export async function seedDemoDataset(): Promise<string> {
  const supabase = getSupabaseServerClient();
  const existingDatasets = await listDatasets();
  const existing = existingDatasets.find((d) => d.name === DEMO_DATASET_NAME && d.mode === 'SAMPLE');

  let datasetId: string;

  if (existing) {
    console.log(`[demo:seed] Found existing SAMPLE dataset: ${existing.id} (${existing.name})`);
    datasetId = existing.id;
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
      description:
        'Chunk 3 founder demo dataset: 6 pharmacies, 8 products, 6 suppliers, ~300 engineered orders demonstrating supplier intelligence, promise risk, performance coaching, and pharmacy service risk.',
    });
    datasetId = created.id;
  }

  console.log(`[demo:seed] Populating records for dataset ${datasetId}...`);

  // ── 1. Pharmacies ────────────────────────────────────────────────────────
  const pharmacies = await insertMany('pharmacies', [
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-CAIRO-01',   name: 'Nile Pharmacy · Cairo Central'    },
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-CAIRO-02',   name: 'Zamalek Care Pharmacy'            },
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-GIZA-03',    name: 'Pyramids Health · Giza'           },
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-ALEX-04',    name: 'Alexandria Pharma Hub'            },
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-LUXOR-05',   name: 'Luxor Medical Dispensary'         },
    { dataset_id: datasetId, external_pharmacy_id: 'PHARM-MANS-06',    name: 'Mansoura City Pharmacy'           },
  ]);
  const pharmMap = new Map(pharmacies.map((p) => [p.external_pharmacy_id, p.id]));

  // ── 2. Products ──────────────────────────────────────────────────────────
  const products = await insertMany('products', [
    { dataset_id: datasetId, external_product_id: 'PROD-PARA-500',  name: 'Paracetamol 500mg Tablets (20s)',           name_normalized: 'paracetamol 500mg tablets 20s'           },
    { dataset_id: datasetId, external_product_id: 'PROD-AMOX-500',  name: 'Amoxicillin 500mg Capsules (16s)',           name_normalized: 'amoxicillin 500mg capsules 16s'          },
    { dataset_id: datasetId, external_product_id: 'PROD-OMEP-20',   name: 'Omeprazole 20mg Delayed-Release (14s)',      name_normalized: 'omeprazole 20mg delayed-release 14s'     },
    { dataset_id: datasetId, external_product_id: 'PROD-METF-850',  name: 'Metformin 850mg Tablets (30s)',              name_normalized: 'metformin 850mg tablets 30s'             },
    { dataset_id: datasetId, external_product_id: 'PROD-ATOR-20',   name: 'Atorvastatin 20mg Tablets (28s)',            name_normalized: 'atorvastatin 20mg tablets 28s'           },
    { dataset_id: datasetId, external_product_id: 'PROD-IBUP-400',  name: 'Ibuprofen 400mg Tablets (24s)',              name_normalized: 'ibuprofen 400mg tablets 24s'             },
    { dataset_id: datasetId, external_product_id: 'PROD-AMLO-5',    name: 'Amlodipine 5mg Tablets (30s)',               name_normalized: 'amlodipine 5mg tablets 30s'             },
    { dataset_id: datasetId, external_product_id: 'PROD-AZIT-250',  name: 'Azithromycin 250mg Tablets (6s)',            name_normalized: 'azithromycin 250mg tablets 6s'           },
  ]);
  const prodMap = new Map(products.map((p) => [p.external_product_id, p.id]));

  // ── 3. Suppliers ─────────────────────────────────────────────────────────
  // SUP-01: Healthy, consistent
  // SUP-02: Deteriorating (fill rate + cancellations in recent window)
  // SUP-03: Mixed — good on PARA/METF, poor on AMOX (product-split demo)
  // SUP-04: Promise-breaker (honoured < 65% of delivery promises) → promise risk HIGH
  // SUP-05: Healthy steady performer
  // SUP-06: Insufficient data (only 3 orders)
  const suppliers = await insertMany('suppliers', [
    { dataset_id: datasetId, external_supplier_id: 'SUP-NILE-01',   name: 'Nile Delta Medical Supplies',   name_normalized: 'nile delta medical supplies'   },
    { dataset_id: datasetId, external_supplier_id: 'SUP-HORUS-02',  name: 'Horus Distribution Co.',        name_normalized: 'horus distribution co'          },
    { dataset_id: datasetId, external_supplier_id: 'SUP-MIXED-03',  name: 'Cairo Cross-Pharma',            name_normalized: 'cairo cross-pharma'            },
    { dataset_id: datasetId, external_supplier_id: 'SUP-PROM-04',   name: 'Delta Promise Wholesale',       name_normalized: 'delta promise wholesale'        },
    { dataset_id: datasetId, external_supplier_id: 'SUP-APEX-05',   name: 'Apex Pharma Logistics',         name_normalized: 'apex pharma logistics'          },
    { dataset_id: datasetId, external_supplier_id: 'SUP-NEW-06',    name: 'Upper Egypt New Pharma',        name_normalized: 'upper egypt new pharma'         },
  ]);
  const suppMap = new Map(suppliers.map((s) => [s.external_supplier_id, s.id]));

  // ── 4. Date generators ───────────────────────────────────────────────────
  // Baseline window: ~30 days before recent window
  // Recent window: last 14 days before AS_OF_DATE (Aug 1–14)
  const baselineDates30 = Array.from({ length: 30 }, (_, i) =>
    `2026-07-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`
  );
  const recentDates14 = Array.from({ length: 14 }, (_, i) =>
    `2026-08-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`
  );
  const recentDates10 = recentDates14.slice(0, 10);

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
    promisedDeliveryHours: number; // hours after placedAt for the offer promise
  }

  const orderSpecs: OrderSpec[] = [];

  // ── SUP-01 (Healthy): 30 baseline + 14 recent, PARA-500, CAIRO-01 ───────
  baselineDates30.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-S01-B-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-CAIRO-01',
      prodExtId: 'PROD-PARA-500',
      suppExtId: 'SUP-NILE-01',
      placedAt: placed,
      requestedQty: 60,
      filledQty: 60,
      deliveredAt: addHours(placed, 22),
      cancelled: false,
      unitPrice: '1700',
      discountBps: 500,
      promisedDeliveryHours: 24,
    });
  });
  recentDates14.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-S01-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-CAIRO-01',
      prodExtId: 'PROD-PARA-500',
      suppExtId: 'SUP-NILE-01',
      placedAt: placed,
      requestedQty: 60,
      filledQty: 60,
      deliveredAt: addHours(placed, 21),
      cancelled: false,
      unitPrice: '1700',
      discountBps: 500,
      promisedDeliveryHours: 24,
    });
  });

  // ── SUP-02 (Deteriorating): 30 baseline (healthy) + 10 recent (bad) ─────
  // AMOX-500, CAIRO-02 (this pharmacy gets HIGH_RISK due to exceptions below)
  baselineDates30.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-S02-B-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-CAIRO-02',
      prodExtId: 'PROD-AMOX-500',
      suppExtId: 'SUP-HORUS-02',
      placedAt: placed,
      requestedQty: 40,
      filledQty: 40,
      deliveredAt: addHours(placed, 20),
      cancelled: false,
      unitPrice: '2500',
      discountBps: 200,
      promisedDeliveryHours: 24,
    });
  });
  recentDates10.forEach((placed, i) => {
    // 3 partial fills, 2 cancellations, 2 late
    const isCancelled = i === 8 || i === 9;
    const isPartial = i === 4 || i === 5 || i === 6;
    const isLate = i === 0 || i === 1;
    const filled = isCancelled ? 0 : isPartial ? 18 : 40;
    const delivered = isCancelled ? null : isLate ? addHours(placed, 72) : addHours(placed, 20);
    orderSpecs.push({
      extId: `ORD-S02-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-CAIRO-02',
      prodExtId: 'PROD-AMOX-500',
      suppExtId: 'SUP-HORUS-02',
      placedAt: placed,
      requestedQty: 40,
      filledQty: filled,
      deliveredAt: delivered,
      cancelled: isCancelled,
      cancellationReason: isCancelled ? 'Stock exhausted — order cancelled by supplier.' : null,
      unitPrice: '2500',
      discountBps: 200,
      promisedDeliveryHours: 24,
    });
  });

  // ── SUP-03 (Mixed): good on PARA (GIZA-03), poor on AMOX (MANS-06) ──────
  // PARA baseline 20 + recent 10 = healthy
  baselineDates30.slice(0, 20).forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-S03-PARA-B-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-GIZA-03',
      prodExtId: 'PROD-PARA-500',
      suppExtId: 'SUP-MIXED-03',
      placedAt: placed,
      requestedQty: 35,
      filledQty: 35,
      deliveredAt: addHours(placed, 18),
      cancelled: false,
      unitPrice: '1650',
      discountBps: 300,
      promisedDeliveryHours: 24,
    });
  });
  recentDates10.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-S03-PARA-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-GIZA-03',
      prodExtId: 'PROD-PARA-500',
      suppExtId: 'SUP-MIXED-03',
      placedAt: placed,
      requestedQty: 35,
      filledQty: 35,
      deliveredAt: addHours(placed, 18),
      cancelled: false,
      unitPrice: '1650',
      discountBps: 300,
      promisedDeliveryHours: 24,
    });
  });
  // AMOX baseline 20 = healthy, recent 10 = deteriorating (fills drop)
  baselineDates30.slice(0, 20).forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-S03-AMOX-B-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-MANS-06',
      prodExtId: 'PROD-AMOX-500',
      suppExtId: 'SUP-MIXED-03',
      placedAt: placed,
      requestedQty: 30,
      filledQty: 30,
      deliveredAt: addHours(placed, 20),
      cancelled: false,
      unitPrice: '2450',
      discountBps: 100,
      promisedDeliveryHours: 24,
    });
  });
  recentDates10.forEach((placed, i) => {
    // 7 of 10 only partially filled → AMOX fill rate crashes
    const isPartial = i < 7;
    orderSpecs.push({
      extId: `ORD-S03-AMOX-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-MANS-06',
      prodExtId: 'PROD-AMOX-500',
      suppExtId: 'SUP-MIXED-03',
      placedAt: placed,
      requestedQty: 30,
      filledQty: isPartial ? 10 : 30,
      deliveredAt: addHours(placed, 20),
      cancelled: false,
      unitPrice: '2450',
      discountBps: 100,
      promisedDeliveryHours: 24,
    });
  });

  // ── SUP-04 (Promise-breaker): OMEP-20, ALEX-04 ───────────────────────────
  // Baseline 20 = delivered OK (health metrics fine), but promises set to 24h,
  // actually delivered in 48-72h → promise fidelity LOW → HIGH promise risk
  baselineDates30.slice(0, 20).forEach((placed, i) => {
    // Baseline: promises given 24h, delivered in 22h (honoured)
    orderSpecs.push({
      extId: `ORD-S04-B-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-ALEX-04',
      prodExtId: 'PROD-OMEP-20',
      suppExtId: 'SUP-PROM-04',
      placedAt: placed,
      requestedQty: 25,
      filledQty: 25,
      deliveredAt: addHours(placed, 22),
      cancelled: false,
      unitPrice: '3100',
      discountBps: 250,
      promisedDeliveryHours: 24,
    });
  });
  recentDates14.forEach((placed, i) => {
    // Recent: promises 24h but delivered 48-96h → only ~20% honoured
    const deliveryHours = i % 5 === 0 ? 20 : 60 + (i * 4); // only i=0,5,10 delivered on time
    orderSpecs.push({
      extId: `ORD-S04-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-ALEX-04',
      prodExtId: 'PROD-OMEP-20',
      suppExtId: 'SUP-PROM-04',
      placedAt: placed,
      requestedQty: 25,
      filledQty: 25,
      deliveredAt: addHours(placed, deliveryHours),
      cancelled: false,
      unitPrice: '3100',
      discountBps: 250,
      promisedDeliveryHours: 24, // promised 24h but delivered late
    });
  });

  // ── SUP-05 (Healthy steady): METF-850 + ATOR-20, LUXOR-05 ───────────────
  baselineDates30.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-S05-METF-B-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-LUXOR-05',
      prodExtId: 'PROD-METF-850',
      suppExtId: 'SUP-APEX-05',
      placedAt: placed,
      requestedQty: 50,
      filledQty: 50,
      deliveredAt: addHours(placed, 18),
      cancelled: false,
      unitPrice: '1200',
      discountBps: 100,
      promisedDeliveryHours: 24,
    });
  });
  recentDates14.forEach((placed, i) => {
    orderSpecs.push({
      extId: `ORD-S05-METF-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-LUXOR-05',
      prodExtId: 'PROD-METF-850',
      suppExtId: 'SUP-APEX-05',
      placedAt: placed,
      requestedQty: 50,
      filledQty: 50,
      deliveredAt: addHours(placed, 19),
      cancelled: false,
      unitPrice: '1200',
      discountBps: 100,
      promisedDeliveryHours: 24,
    });
  });

  // ── SUP-06 (Insufficient data): only 3 orders ────────────────────────────
  ['2026-08-12T09:00:00.000Z', '2026-08-13T09:00:00.000Z', '2026-08-14T09:00:00.000Z'].forEach(
    (placed, i) => {
      orderSpecs.push({
        extId: `ORD-S06-LOW-${i + 1}`,
        pharmExtId: 'PHARM-CAIRO-01',
        prodExtId: 'PROD-IBUP-400',
        suppExtId: 'SUP-NEW-06',
        placedAt: placed,
        requestedQty: 20,
        filledQty: 20,
        deliveredAt: addHours(placed, 16),
        cancelled: false,
        unitPrice: '900',
        discountBps: 50,
        promisedDeliveryHours: 24,
      });
    }
  );

  // ── Extra IBUP orders for CAIRO-02 pharmacy to make it HIGH_RISK ─────────
  // CAIRO-02 already has bad S02 orders above. Add some extra cancellations via APEX-05
  recentDates10.slice(0, 8).forEach((placed, i) => {
    const isCancelled = i < 5; // 5 cancellations → HIGH_RISK pharmacy
    orderSpecs.push({
      extId: `ORD-CAIRO02-IBUP-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-CAIRO-02',
      prodExtId: 'PROD-IBUP-400',
      suppExtId: 'SUP-APEX-05',
      placedAt: placed,
      requestedQty: 30,
      filledQty: isCancelled ? 0 : 30,
      deliveredAt: isCancelled ? null : addHours(placed, 20),
      cancelled: isCancelled,
      cancellationReason: isCancelled ? 'Product unavailable at short notice.' : null,
      unitPrice: '950',
      discountBps: 100,
      promisedDeliveryHours: 24,
    });
  });

  // ── MANS-06 pharmacy: AT_RISK (moderate exception rate from S03-AMOX) ────
  // Already partially handled above. Add a few more AZIT orders with partials.
  recentDates10.slice(0, 6).forEach((placed, i) => {
    const isPartial = i < 3;
    orderSpecs.push({
      extId: `ORD-MANS06-AZIT-R-${String(i + 1).padStart(2, '0')}`,
      pharmExtId: 'PHARM-MANS-06',
      prodExtId: 'PROD-AZIT-250',
      suppExtId: 'SUP-NILE-01',
      placedAt: placed,
      requestedQty: 20,
      filledQty: isPartial ? 8 : 20,
      deliveredAt: addHours(placed, 22),
      cancelled: false,
      unitPrice: '4200',
      discountBps: 150,
      promisedDeliveryHours: 24,
    });
  });

  console.log(`[demo:seed] Inserting ${orderSpecs.length} order specs...`);

  // ── Insert orders ────────────────────────────────────────────────────────
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

  // ── Insert order items ───────────────────────────────────────────────────
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

  // ── Insert supplier offers (with promised delivery dates) ────────────────
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
      // Promised delivery date is key for promise risk evaluation
      promised_delivery_at: addHours(s.placedAt, s.promisedDeliveryHours),
      offered_at: addHours(s.placedAt, 1),
    })) as never
  );

  // ── Insert AI decisions ──────────────────────────────────────────────────
  await insertMany(
    'ai_decisions',
    orderSpecs.map((s) => ({
      dataset_id: datasetId,
      external_decision_id: `DEC-${s.extId}`,
      order_id: orderMap.get(s.extId)!,
      selected_supplier_id: suppMap.get(s.suppExtId)!,
      decided_at: addHours(s.placedAt, 2),
      agent_name: 'cluster-resolve-v1',
      agent_version: '1.0.0',
      confidence: 0.87,
      selection_reason: buildDecisionReason(s.suppExtId, s.prodExtId),
    }))
  );

  // ── Insert order outcomes ────────────────────────────────────────────────
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

  console.log(`[demo:seed] Inserted ${orderSpecs.length} orders and all related entities.`);
  console.log(`[demo:seed] Running evaluation on dataset ${datasetId}...`);

  const evalResult = await evaluateDatasetOperations(datasetId, AS_OF_DATE);
  console.log(
    `[demo:seed] Evaluation complete: ${evalResult.ordersLoaded} orders, ` +
    `${evalResult.exceptionsPersisted} exceptions, ${evalResult.suppliersEvaluated} suppliers.`
  );
  console.log(`[demo:seed] Supplier statuses:`, evalResult.suppliersByStatus);

  return datasetId;

  // ── Helpers ──────────────────────────────────────────────────────────────
  async function insertMany<T extends keyof PublicTables>(
    table: T,
    values: Array<PublicTables[T]['Insert']>
  ): Promise<Array<PublicTables[T]['Row']>> {
    // Insert in chunks to avoid request size limits
    const CHUNK = 100;
    const result: Array<PublicTables[T]['Row']> = [];
    for (let i = 0; i < values.length; i += CHUNK) {
      const chunk = values.slice(i, i + CHUNK);
      const { data, error } = await supabase.from(table as never).insert(chunk as never).select('*');
      if (error) throw error;
      result.push(...((data ?? []) as unknown as Array<PublicTables[T]['Row']>));
    }
    return result;
  }
}

function addHours(isoString: string, hours: number): string {
  return new Date(Date.parse(isoString) + hours * 3_600_000).toISOString();
}

function buildDecisionReason(suppExtId: string, prodExtId: string): string {
  const supplier = {
    'SUP-NILE-01': 'Nile Delta Medical Supplies',
    'SUP-HORUS-02': 'Horus Distribution Co.',
    'SUP-MIXED-03': 'Cairo Cross-Pharma',
    'SUP-PROM-04': 'Delta Promise Wholesale',
    'SUP-APEX-05': 'Apex Pharma Logistics',
    'SUP-NEW-06': 'Upper Egypt New Pharma',
  }[suppExtId] ?? suppExtId;
  return `Selected ${supplier} based on lowest unit price and historical fill-rate for ${prodExtId}. AI confidence: 87%.`;
}

// Auto-run when executed directly
if (process.argv[1]?.includes('demo-seed')) {
  seedDemoDataset()
    .then((id) => {
      console.log(`[demo:seed] SUCCESS! Founder demo dataset ID: ${id}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[demo:seed] FAILED:', err);
      process.exit(1);
    });
}
