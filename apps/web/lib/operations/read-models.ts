import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '../supabase/server';

interface OrderBase { id: string; external_order_id: string; pharmacy_id: string; status: string; placed_at: string }
interface PharmacyBase { id: string; external_pharmacy_id: string; name: string | null }
interface SupplierBase { id: string; external_supplier_id: string; name: string }
interface ItemBase { id: string; order_id: string; product_id: string; requested_qty: number; unit: string }
interface OutcomeBase {
  id: string; order_id: string; supplier_id: string; product_id: string; filled_qty: number;
  delivered_at: string | null; cancelled: boolean; cancellation_reason: string | null; outcome_final: boolean;
}
interface ExceptionBase {
  id: string; order_id: string; supplier_id: string | null; product_id: string | null;
  type: string; severity: string; evidence_json: unknown; detected_at: string; engine_version: string;
}
interface ProductBase { id: string; external_product_id: string; name: string }
interface DecisionBase { id: string; external_decision_id: string; order_id: string; selected_supplier_id: string; decided_at: string }
interface SnapshotBase {
  supplier_id: string; as_of_date: string; status: string; recent_evaluated_orders: number;
  baseline_evaluated_orders: number; recent_fill_rate_bps: number | null; baseline_fill_rate_bps: number | null;
  recent_otif_rate_bps: number | null; baseline_otif_rate_bps: number | null;
  recent_cancellation_rate_bps: number | null; baseline_cancellation_rate_bps: number | null;
  recent_partial_fill_rate_bps: number | null; baseline_partial_fill_rate_bps: number | null;
  recent_lead_time_p50_minutes: number | null; recent_lead_time_p95_minutes: number | null;
  baseline_lead_time_p95_minutes: number | null; triggers_json: unknown; engine_version: string;
}

export async function listOrderReadModels(datasetId: string) {
  const source = await loadOrderReadSource(datasetId);
  return source.orders.map((order) => {
    const items = source.items.filter((value) => value.order_id === order.id);
    const outcomes = source.outcomes.filter((value) => value.order_id === order.id && value.outcome_final);
    const exceptions = source.exceptions.filter((value) => value.order_id === order.id);
    const supplierIds = [...new Set(outcomes.map((value) => value.supplier_id))];
    return {
      id: order.id,
      externalOrderId: order.external_order_id,
      status: order.status,
      placedAt: order.placed_at,
      pharmacy: source.pharmacies.get(order.pharmacy_id) ?? null,
      suppliers: supplierIds.map((id) => source.suppliers.get(id)).filter(Boolean),
      requestedUnits: items.reduce((sum, value) => sum + value.requested_qty, 0),
      filledUnits: outcomes.reduce((sum, value) => sum + value.filled_qty, 0),
      deliveryState: deliveryState(outcomes, exceptions),
      exceptionSummary: summarizeExceptions(exceptions),
    };
  });
}

export async function getOrderReadModel(datasetId: string, orderId: string) {
  const source = await loadOrderReadSource(datasetId);
  const order = source.orders.find((value) => value.id === orderId);
  if (!order) return null;
  const supabase = getSupabaseServerClient();
  const [products, offers, decisions] = await Promise.all([
    fetchPaged<ProductBase>((from, to) => supabase.from('products').select('id, external_product_id, name').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged<Record<string, unknown>>(
      ((from: number, to: number) =>
        supabase
          .from('supplier_offers')
          .select('id, external_offer_id, order_id, supplier_id, product_id, available_qty, unit_price_minor::text, discount_bps, promised_delivery_at, offered_at')
          .eq('dataset_id', datasetId)
          .eq('order_id', orderId)
          .range(from, to)) as never
    ),
    fetchPaged<DecisionBase>((from, to) => supabase.from('ai_decisions').select('id, external_decision_id, order_id, selected_supplier_id, decided_at').eq('dataset_id', datasetId).eq('order_id', orderId).range(from, to)),
  ]);
  const productMap = new Map(products.map((value) => [value.id, value]));
  const items = source.items.filter((value) => value.order_id === orderId);
  const outcomes = source.outcomes.filter((value) => value.order_id === orderId);
  const exceptions = source.exceptions.filter((value) => value.order_id === orderId);
  return {
    order: {
      id: order.id,
      externalOrderId: order.external_order_id,
      status: order.status,
      placedAt: order.placed_at,
      pharmacy: source.pharmacies.get(order.pharmacy_id) ?? null,
    },
    items: items.map((value) => ({ ...value, product: productMap.get(value.product_id) ?? null })),
    outcomes: outcomes.map((value) => ({ ...value, supplier: source.suppliers.get(value.supplier_id) ?? null })),
    offers: offers.map((value) => ({
      ...value,
      unit_price_minor: String(value.unit_price_minor),
      supplier: source.suppliers.get(String(value.supplier_id)) ?? null,
      product: productMap.get(String(value.product_id)) ?? null,
    })),
    decisions,
    exceptions,
  };
}

export async function listSupplierReadModels(datasetId: string) {
  const supabase = getSupabaseServerClient();
  const [suppliers, snapshots] = await Promise.all([
    fetchPaged<SupplierBase>((from, to) => supabase.from('suppliers').select('id, external_supplier_id, name').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged<SnapshotBase>((from, to) => supabase.from('supplier_reliability_snapshots').select('*').eq('dataset_id', datasetId).order('as_of_date', { ascending: false }).range(from, to)),
  ]);
  const latest = firstBy(snapshots, (value) => value.supplier_id);
  return suppliers.map((supplier) => ({ supplier, reliability: latest.get(supplier.id) ?? null }));
}

export async function getSupplierReadModel(datasetId: string, supplierId: string) {
  const supabase = getSupabaseServerClient();
  const supplierResult = await supabase.from('suppliers').select('id, external_supplier_id, name').eq('dataset_id', datasetId).eq('id', supplierId).maybeSingle();
  if (supplierResult.error) throw supplierResult.error;
  if (!supplierResult.data) return null;
  const [snapshots, exceptions, outcomes, decisions, orders] = await Promise.all([
    fetchPaged<SnapshotBase>((from, to) => supabase.from('supplier_reliability_snapshots').select('*').eq('dataset_id', datasetId).eq('supplier_id', supplierId).order('as_of_date', { ascending: false }).range(from, to)),
    fetchPaged<ExceptionBase>((from, to) => supabase.from('order_exceptions').select('id, order_id, supplier_id, product_id, type, severity, evidence_json, detected_at, engine_version').eq('dataset_id', datasetId).eq('supplier_id', supplierId).range(from, to)),
    fetchPaged<OutcomeBase>((from, to) => supabase.from('order_outcomes').select('id, order_id, supplier_id, product_id, filled_qty, delivered_at, cancelled, cancellation_reason, outcome_final').eq('dataset_id', datasetId).eq('supplier_id', supplierId).range(from, to)),
    fetchPaged<DecisionBase>((from, to) => supabase.from('ai_decisions').select('id, external_decision_id, order_id, selected_supplier_id, decided_at').eq('dataset_id', datasetId).eq('selected_supplier_id', supplierId).range(from, to)),
    fetchPaged<OrderBase>((from, to) => supabase.from('orders').select('id, external_order_id, pharmacy_id, status, placed_at').eq('dataset_id', datasetId).range(from, to)),
  ]);
  const affectedIds = new Set([...exceptions.map((value) => value.order_id), ...outcomes.map((value) => value.order_id)]);
  return {
    supplier: supplierResult.data,
    latestReliability: snapshots[0] ?? null,
    snapshots,
    exceptions,
    affectedOrders: orders.filter((value) => affectedIds.has(value.id)),
    decisions,
  };
}

async function loadOrderReadSource(datasetId: string) {
  const supabase = getSupabaseServerClient();
  const [orders, pharmacies, suppliers, items, outcomes, exceptions] = await Promise.all([
    fetchPaged<OrderBase>((from, to) => supabase.from('orders').select('id, external_order_id, pharmacy_id, status, placed_at').eq('dataset_id', datasetId).order('placed_at', { ascending: false }).range(from, to)),
    fetchPaged<PharmacyBase>((from, to) => supabase.from('pharmacies').select('id, external_pharmacy_id, name').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged<SupplierBase>((from, to) => supabase.from('suppliers').select('id, external_supplier_id, name').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged<ItemBase>((from, to) => supabase.from('order_items').select('id, order_id, product_id, requested_qty, unit').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged<OutcomeBase>((from, to) => supabase.from('order_outcomes').select('id, order_id, supplier_id, product_id, filled_qty, delivered_at, cancelled, cancellation_reason, outcome_final').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged<ExceptionBase>((from, to) => supabase.from('order_exceptions').select('id, order_id, supplier_id, product_id, type, severity, evidence_json, detected_at, engine_version').eq('dataset_id', datasetId).range(from, to)),
  ]);
  return {
    orders,
    pharmacies: new Map(pharmacies.map((value) => [value.id, value])),
    suppliers: new Map(suppliers.map((value) => [value.id, value])),
    items,
    outcomes,
    exceptions,
  };
}

function deliveryState(outcomes: OutcomeBase[], exceptions: ExceptionBase[]): string {
  if (outcomes.length === 0) return 'INSUFFICIENT_DATA';
  if (exceptions.some((value) => value.type === 'CANCELLED')) return 'CANCELLED';
  if (exceptions.some((value) => value.type === 'UNFULFILLED')) return 'UNFULFILLED';
  if (exceptions.some((value) => value.type === 'PARTIAL_FILL')) return 'PARTIAL_FILL';
  if (outcomes.every((value) => value.outcome_final && value.delivered_at !== null)) return 'DELIVERED';
  return 'INSUFFICIENT_DATA';
}

function summarizeExceptions(exceptions: ExceptionBase[]) {
  return {
    count: exceptions.length,
    types: [...new Set(exceptions.map((value) => value.type))].sort(),
    highestSeverity: exceptions.some((value) => value.severity === 'HIGH')
      ? 'HIGH'
      : exceptions.length > 0 ? 'MEDIUM' : null,
  };
}

const PAGE_SIZE = 1_000;
async function fetchPaged<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function firstBy<T>(values: T[], key: (value: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) if (!result.has(key(value))) result.set(key(value), value);
  return result;
}
