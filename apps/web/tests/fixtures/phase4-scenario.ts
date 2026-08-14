import { createDataset } from '../../lib/db/repositories/datasets';
import type { Database } from '../../lib/db/generated-types';
import { getSupabaseServerClient } from '../../lib/supabase/server';

type PublicTables = Database['public']['Tables'];

export const PHASE4_AS_OF = '2026-08-14T00:00:00.000Z';

export interface Phase4Scenario {
  datasetId: string;
  supplierIds: { deteriorating: string; healthy: string; lowSample: string };
  orderIds: { partial: string; cancelled: string; unfulfilled: string; late: string };
  outcomeIds: { partial: string };
  expected: {
    deterioratingRecentFillBps: number;
    deterioratingBaselineFillBps: number;
    deterioratingRecentOtifBps: number;
    deterioratingBaselineOtifBps: number;
  };
}

interface ScenarioOrder {
  externalId: string;
  supplier: 'deteriorating' | 'healthy' | 'lowSample';
  placedAt: string;
  filledQty: number;
  deliveredAt: string | null;
  cancelled: boolean;
}

export async function seedPhase4Scenario(): Promise<Phase4Scenario> {
  const supabase = getSupabaseServerClient();
  const dataset = await createDataset({
    name: 'Phase 4 Deterministic Reliability Scenario',
    mode: 'SAMPLE',
    description: 'Deterministic SAMPLE evidence for Phase 4 acceptance.',
  });
  const pharmacy = await insertOne('pharmacies', {
    dataset_id: dataset.id,
    external_pharmacy_id: 'P4-PHARMACY',
    name: 'Phase 4 Evidence Pharmacy',
  });
  const product = await insertOne('products', {
    dataset_id: dataset.id,
    external_product_id: 'P4-PRODUCT',
    name: 'Phase 4 Evidence Product',
    name_normalized: 'phase 4 evidence product',
  });
  const supplierRows = await insertMany('suppliers', [
    { dataset_id: dataset.id, external_supplier_id: 'P4-DETERIORATING', name: 'Deteriorating Supplier', name_normalized: 'deteriorating supplier' },
    { dataset_id: dataset.id, external_supplier_id: 'P4-HEALTHY', name: 'Healthy Supplier', name_normalized: 'healthy supplier' },
    { dataset_id: dataset.id, external_supplier_id: 'P4-LOW-SAMPLE', name: 'Low Sample Supplier', name_normalized: 'low sample supplier' },
  ]);
  const supplierIds = {
    deteriorating: supplierRows.find((value) => value.external_supplier_id === 'P4-DETERIORATING')!.id,
    healthy: supplierRows.find((value) => value.external_supplier_id === 'P4-HEALTHY')!.id,
    lowSample: supplierRows.find((value) => value.external_supplier_id === 'P4-LOW-SAMPLE')!.id,
  };

  const scenarioOrders = buildScenarioOrders();
  const orderRows = await insertMany('orders', scenarioOrders.map((value) => ({
    dataset_id: dataset.id,
    external_order_id: value.externalId,
    pharmacy_id: pharmacy.id,
    status: 'IMPORTED',
    placed_at: value.placedAt,
  })));
  const orderByExternal = new Map(orderRows.map((value) => [value.external_order_id, value]));
  await insertMany('order_items', scenarioOrders.map((value) => ({
    dataset_id: dataset.id,
    order_id: orderByExternal.get(value.externalId)!.id,
    product_id: product.id,
    requested_qty: 10,
    unit: 'pack',
  })));
  const offers = await insertMany('supplier_offers', scenarioOrders.map((value) => ({
    dataset_id: dataset.id,
    external_offer_id: `OFFER-${value.externalId}`,
    order_id: orderByExternal.get(value.externalId)!.id,
    supplier_id: supplierIds[value.supplier],
    product_id: product.id,
    available_qty: 10,
    unit_price_minor: '12550',
    discount_bps: 0,
    promised_delivery_at: addMinutes(value.placedAt, 1_440),
    offered_at: addMinutes(value.placedAt, 60),
  })) as never);
  const offerByOrder = new Map(offers.map((value) => [value.order_id, value]));
  await insertMany('ai_decisions', scenarioOrders.map((value) => ({
    dataset_id: dataset.id,
    external_decision_id: `DECISION-${value.externalId}`,
    order_id: orderByExternal.get(value.externalId)!.id,
    selected_supplier_id: supplierIds[value.supplier],
    decided_at: addMinutes(value.placedAt, 120),
    selection_reason: `Selected from ${offerByOrder.get(orderByExternal.get(value.externalId)!.id)!.external_offer_id}`,
  })));
  const outcomes = await insertMany('order_outcomes', scenarioOrders.map((value) => ({
    dataset_id: dataset.id,
    order_id: orderByExternal.get(value.externalId)!.id,
    supplier_id: supplierIds[value.supplier],
    product_id: product.id,
    filled_qty: value.filledQty,
    delivered_at: value.deliveredAt,
    cancelled: value.cancelled,
    cancellation_reason: value.cancelled ? 'Supplier confirmed cancellation.' : null,
    outcome_final: true,
  })));
  const outcomeByOrder = new Map(outcomes.map((value) => [value.order_id, value]));

  const partialOrder = orderByExternal.get('P4-DET-R-07')!;
  return {
    datasetId: dataset.id,
    supplierIds,
    orderIds: {
      partial: partialOrder.id,
      cancelled: orderByExternal.get('P4-DET-R-10')!.id,
      unfulfilled: orderByExternal.get('P4-DET-R-09')!.id,
      late: orderByExternal.get('P4-DET-R-01')!.id,
    },
    outcomeIds: { partial: outcomeByOrder.get(partialOrder.id)!.id },
    expected: {
      deterioratingRecentFillBps: 7_000,
      deterioratingBaselineFillBps: 10_000,
      deterioratingRecentOtifBps: 0,
      deterioratingBaselineOtifBps: 10_000,
    },
  };

  async function insertOne<T extends keyof PublicTables>(
    table: T,
    value: PublicTables[T]['Insert']
  ): Promise<PublicTables[T]['Row']> {
    const { data, error } = await supabase.from(table as never).insert(value as never).select('*').single();
    if (error) throw error;
    return data as unknown as PublicTables[T]['Row'];
  }

  async function insertMany<T extends keyof PublicTables>(
    table: T,
    values: Array<PublicTables[T]['Insert']>
  ): Promise<Array<PublicTables[T]['Row']>> {
    const { data, error } = await supabase.from(table as never).insert(values as never).select('*');
    if (error) throw error;
    return (data ?? []) as unknown as Array<PublicTables[T]['Row']>;
  }
}

export async function cleanupPhase4Dataset(datasetId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  for (const table of [
    'supplier_reliability_snapshots',
    'order_exceptions',
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
  ] as const) {
    const { error } = await supabase.from(table).delete().eq('dataset_id', datasetId);
    if (error) throw error;
  }
  const { error } = await supabase.from('datasets').delete().eq('id', datasetId);
  if (error) throw error;
}

function buildScenarioOrders(): ScenarioOrder[] {
  const baselineDates = Array.from({ length: 20 }, (_, index) => `2026-07-${String(index + 4).padStart(2, '0')}T00:00:00.000Z`);
  const recentDates = Array.from({ length: 10 }, (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`);
  const deterioratingBaseline = baselineDates.map((placedAt, index): ScenarioOrder => ({
    externalId: `P4-DET-B-${String(index + 1).padStart(2, '0')}`,
    supplier: 'deteriorating',
    placedAt,
    filledQty: 10,
    deliveredAt: addMinutes(placedAt, 720),
    cancelled: false,
  }));
  const deterioratingRecent = recentDates.map((placedAt, index): ScenarioOrder => ({
    externalId: `P4-DET-R-${String(index + 1).padStart(2, '0')}`,
    supplier: 'deteriorating',
    placedAt,
    filledQty: index < 6 ? 10 : index < 8 ? 5 : 0,
    deliveredAt: index < 8 ? addMinutes(placedAt, 2_160) : null,
    cancelled: index === 9,
  }));
  const healthy = [...baselineDates, ...recentDates].map((placedAt, index): ScenarioOrder => ({
    externalId: `P4-HEALTHY-${String(index + 1).padStart(2, '0')}`,
    supplier: 'healthy',
    placedAt,
    filledQty: 10,
    deliveredAt: addMinutes(placedAt, 720),
    cancelled: false,
  }));
  const lowSample = ['2026-08-11T00:00:00.000Z', '2026-08-12T00:00:00.000Z'].map((placedAt, index): ScenarioOrder => ({
    externalId: `P4-LOW-${index + 1}`,
    supplier: 'lowSample',
    placedAt,
    filledQty: 10,
    deliveredAt: addMinutes(placedAt, 720),
    cancelled: false,
  }));
  return [...deterioratingBaseline, ...deterioratingRecent, ...healthy, ...lowSample];
}

function addMinutes(timestamp: string, minutes: number): string {
  return new Date(Date.parse(timestamp) + minutes * 60_000).toISOString();
}
