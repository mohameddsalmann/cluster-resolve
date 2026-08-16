import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { evaluatePharmacyServiceRisk } from '@cluster/core/supplier/pharmacy-risk';
import { getSupabaseServerClient } from '../supabase/server';
import type { Database } from '../db/generated-types';

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
  /** Added in Chunk 3 migration — optional until remote schema is updated. */
  promise_risk_json?: unknown;
}
type ProductSnapshotRow = Database['public']['Tables']['supplier_product_reliability_snapshots']['Row'];

export async function listOrderReadModels(
  datasetId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const supabase = getSupabaseServerClient();
  const limit = Math.min(250, Math.max(1, options.limit ?? 100));
  const offset = Math.max(0, options.offset ?? 0);
  const { data: orderData, count, error: orderError } = await supabase
    .from('orders')
    .select('id, external_order_id, pharmacy_id, status, placed_at', { count: 'exact' })
    .eq('dataset_id', datasetId)
    .order('placed_at', { ascending: false })
    .order('id')
    .range(offset, offset + limit - 1);
  if (orderError) throw orderError;

  const orders = (orderData ?? []) as OrderBase[];
  const orderIds = orders.map((order) => order.id);
  const pharmacyIds = [...new Set(orders.map((order) => order.pharmacy_id))];
  const [itemsResult, outcomesResult, exceptionsResult, pharmaciesResult, allExceptionOrderIds] = await Promise.all([
    orderIds.length > 0
      ? supabase.from('order_items').select('id, order_id, product_id, requested_qty, unit').eq('dataset_id', datasetId).in('order_id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length > 0
      ? supabase.from('order_outcomes').select('id, order_id, supplier_id, product_id, filled_qty, delivered_at, cancelled, cancellation_reason, outcome_final').eq('dataset_id', datasetId).in('order_id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length > 0
      ? supabase.from('order_exceptions').select('id, order_id, supplier_id, product_id, type, severity, evidence_json, detected_at, engine_version').eq('dataset_id', datasetId).in('order_id', orderIds)
      : Promise.resolve({ data: [], error: null }),
    pharmacyIds.length > 0
      ? supabase.from('pharmacies').select('id, external_pharmacy_id, name').eq('dataset_id', datasetId).in('id', pharmacyIds)
      : Promise.resolve({ data: [], error: null }),
    fetchPaged<{ order_id: string }>((from, to) => supabase
      .from('order_exceptions')
      .select('order_id')
      .eq('dataset_id', datasetId)
      .order('order_id')
      .range(from, to)),
  ]);
  for (const result of [itemsResult, outcomesResult, exceptionsResult, pharmaciesResult]) {
    if (result.error) throw result.error;
  }

  const outcomes = (outcomesResult.data ?? []) as OutcomeBase[];
  const supplierIds = [...new Set(outcomes.map((outcome) => outcome.supplier_id))];
  const suppliersResult = supplierIds.length > 0
    ? await supabase.from('suppliers').select('id, external_supplier_id, name').eq('dataset_id', datasetId).in('id', supplierIds)
    : { data: [], error: null };
  if (suppliersResult.error) throw suppliersResult.error;

  const pharmacies = new Map(((pharmaciesResult.data ?? []) as PharmacyBase[]).map((value) => [value.id, value]));
  const suppliers = new Map(((suppliersResult.data ?? []) as SupplierBase[]).map((value) => [value.id, value]));
  const itemsByOrder = groupBy((itemsResult.data ?? []) as ItemBase[], (value) => value.order_id);
  const outcomesByOrder = groupBy(outcomes.filter((value) => value.outcome_final), (value) => value.order_id);
  const exceptionsByOrder = groupBy((exceptionsResult.data ?? []) as ExceptionBase[], (value) => value.order_id);

  const readModels = orders.map((order) => {
    const items = itemsByOrder.get(order.id) ?? [];
    const finalOutcomes = outcomesByOrder.get(order.id) ?? [];
    const exceptions = exceptionsByOrder.get(order.id) ?? [];
    const rowSupplierIds = [...new Set(finalOutcomes.map((value) => value.supplier_id))];
    return {
      id: order.id,
      externalOrderId: order.external_order_id,
      status: order.status,
      placedAt: order.placed_at,
      pharmacy: pharmacies.get(order.pharmacy_id) ?? null,
      suppliers: rowSupplierIds.map((id) => suppliers.get(id)).filter(Boolean),
      requestedUnits: items.reduce((sum, value) => sum + value.requested_qty, 0),
      filledUnits: finalOutcomes.reduce((sum, value) => sum + value.filled_qty, 0),
      deliveryState: deliveryState(finalOutcomes, exceptions),
      exceptionSummary: summarizeExceptions(exceptions),
    };
  });

  return {
    orders: readModels,
    totalCount: count ?? 0,
    exceptionOrdersCount: new Set(allExceptionOrderIds.map((row) => row.order_id)).size,
  };
}

export async function getOrderReadModel(datasetId: string, orderId: string) {
  const source = await loadOrderReadSource(datasetId, orderId);
  const order = source.orders.find((value) => value.id === orderId);
  if (!order) return null;
  const supabase = getSupabaseServerClient();
  const [products, offers, decisions] = await Promise.all([
    fetchPaged<ProductBase>((from, to) => supabase.from('products').select('id, external_product_id, name').eq('dataset_id', datasetId).order('id').range(from, to)),
    fetchPaged<Record<string, unknown>>(
      ((from: number, to: number) =>
        supabase
          .from('supplier_offers')
          .select('id, external_offer_id, order_id, supplier_id, product_id, available_qty, unit_price_minor::text, discount_bps, promised_delivery_at, offered_at')
          .eq('dataset_id', datasetId)
          .eq('order_id', orderId)
          .order('id')
          .range(from, to)) as never
    ),
    fetchPaged<DecisionBase>((from, to) => supabase.from('ai_decisions').select('id, external_decision_id, order_id, selected_supplier_id, decided_at').eq('dataset_id', datasetId).eq('order_id', orderId).order('id').range(from, to)),
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
    fetchPaged<SupplierBase>((from, to) => supabase.from('suppliers').select('id, external_supplier_id, name').eq('dataset_id', datasetId).order('id').range(from, to)),
    fetchPaged<SnapshotBase>((from, to) => supabase.from('supplier_reliability_snapshots').select('*').eq('dataset_id', datasetId).order('as_of_date', { ascending: false }).order('id').range(from, to)),
  ]);
  const latest = firstBy(snapshots, (value) => value.supplier_id);
  return suppliers.map((supplier) => ({ supplier, reliability: latest.get(supplier.id) ?? null }));
}

export async function getSupplierReadModel(datasetId: string, supplierId: string) {
  const supabase = getSupabaseServerClient();
  const supplierResult = await supabase.from('suppliers').select('id, external_supplier_id, name').eq('dataset_id', datasetId).eq('id', supplierId).maybeSingle();
  if (supplierResult.error) throw supplierResult.error;
  if (!supplierResult.data) return null;

  const [snapshots, productSnapshots, exceptions, outcomes, decisions, orders, products, pharmacies] = await Promise.all([
    fetchPaged<SnapshotBase>((from, to) => supabase.from('supplier_reliability_snapshots').select('*').eq('dataset_id', datasetId).eq('supplier_id', supplierId).order('as_of_date', { ascending: false }).order('id').range(from, to)),
    fetchProductSnapshots(supabase, datasetId, supplierId),
    fetchPaged<ExceptionBase>((from, to) => supabase.from('order_exceptions').select('id, order_id, supplier_id, product_id, type, severity, evidence_json, detected_at, engine_version').eq('dataset_id', datasetId).eq('supplier_id', supplierId).order('id').range(from, to)),
    fetchPaged<OutcomeBase>((from, to) => supabase.from('order_outcomes').select('id, order_id, supplier_id, product_id, filled_qty, delivered_at, cancelled, cancellation_reason, outcome_final').eq('dataset_id', datasetId).eq('supplier_id', supplierId).order('id').range(from, to)),
    fetchPaged<DecisionBase>((from, to) => supabase.from('ai_decisions').select('id, external_decision_id, order_id, selected_supplier_id, decided_at').eq('dataset_id', datasetId).eq('selected_supplier_id', supplierId).order('id').range(from, to)),
    fetchPaged<OrderBase>((from, to) => supabase.from('orders').select('id, external_order_id, pharmacy_id, status, placed_at').eq('dataset_id', datasetId).order('id').range(from, to)),
    fetchPaged<ProductBase>((from, to) => supabase.from('products').select('id, external_product_id, name, manufacturer').eq('dataset_id', datasetId).order('id').range(from, to)),
    fetchPaged<PharmacyBase>((from, to) => supabase.from('pharmacies').select('id, external_pharmacy_id, name').eq('dataset_id', datasetId).order('id').range(from, to)),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const pharmacyMap = new Map(pharmacies.map((p) => [p.id, p]));
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  const affectedIds = new Set([...exceptions.map((value) => value.order_id), ...outcomes.map((value) => value.order_id)]);

  // Latest product snapshot per product + product metadata
  const latestProductSnapshots = firstBy(productSnapshots, (s) => s.product_id);
  const productSnapshotList = [...latestProductSnapshots.values()].map((ps) => ({
    ...ps,
    product: productMap.get(ps.product_id) ?? null,
  }));

  // Time-bucketed monthly trends from real persisted outcomes
  const monthlyBuckets = new Map<string, { total: number; cancelled: number; partial: number; leadTimesHours: number[] }>();
  for (const outcome of outcomes) {
    const order = orderMap.get(outcome.order_id);
    const dateStr = outcome.delivered_at || order?.placed_at;
    if (!dateStr) continue;
    const month = dateStr.slice(0, 7); // YYYY-MM
    if (!monthlyBuckets.has(month)) {
      monthlyBuckets.set(month, { total: 0, cancelled: 0, partial: 0, leadTimesHours: [] });
    }
    const b = monthlyBuckets.get(month)!;
    b.total++;
    if (outcome.cancelled) {
      b.cancelled++;
    } else if (outcome.delivered_at && order?.placed_at) {
      const hours = (Date.parse(outcome.delivered_at) - Date.parse(order.placed_at)) / 3_600_000;
      if (hours >= 0 && hours < 500) b.leadTimesHours.push(hours);
    }
  }

  const monthlyTrends = [...monthlyBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => {
      const sortedLead = [...b.leadTimesHours].sort((x, y) => x - y);
      const medianLead = sortedLead.length > 0 ? sortedLead[Math.floor(sortedLead.length / 2)] : null;
      return {
        month,
        evaluatedOrders: b.total,
        cancellationRateBps: b.total > 0 ? Math.round((b.cancelled / b.total) * 10000) : 0,
        medianLeadTimeHours: medianLead !== null ? Math.round(medianLead * 10) / 10 : null,
      };
    });

  // Top Deteriorating Products
  const deterioratingProducts = productSnapshotList
    .filter((p) => {
      const status = String(p.status ?? '');
      const baseline = typeof p.baseline_fill_rate_bps === 'number' ? p.baseline_fill_rate_bps : null;
      const recent = typeof p.recent_fill_rate_bps === 'number' ? p.recent_fill_rate_bps : null;
      return status === 'HIGH' || status === 'WATCH' || (baseline !== null && recent !== null && recent < baseline);
    })
    .slice(0, 5);

  // Pharmacies with Most Exceptions
  const pharmacyExceptionCounts = new Map<string, number>();
  for (const exc of exceptions) {
    const order = orderMap.get(exc.order_id);
    if (order?.pharmacy_id) {
      pharmacyExceptionCounts.set(order.pharmacy_id, (pharmacyExceptionCounts.get(order.pharmacy_id) ?? 0) + 1);
    }
  }
  const topPharmaciesWithExceptions = [...pharmacyExceptionCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([pharmacyId, count]) => ({
      pharmacy: pharmacyMap.get(pharmacyId) ?? { id: pharmacyId, external_pharmacy_id: pharmacyId, name: 'Unknown' },
      exceptionCount: count,
    }));

  return {
    supplier: supplierResult.data,
    latestReliability: snapshots[0] ?? null,
    snapshots,
    productSnapshots: productSnapshotList,
    monthlyTrends,
    driverAnalysis: {
      deterioratingProducts,
      topPharmaciesWithExceptions,
    },
    exceptions,
    affectedOrders: orders.filter((value) => affectedIds.has(value.id)),
    decisions,
  };
}

export async function listPharmacyReadModels(datasetId: string) {
  const supabase = getSupabaseServerClient();
  interface PharmacyRow { id: string; external_pharmacy_id: string; name: string | null }
  interface OrderForPharmacy { id: string; pharmacy_id: string }
  interface ExceptionForPharmacy { id: string; order_id: string; type: string; severity: string }
  interface EvaluatedOutcome { order_id: string }

  const [pharmacies, orders, exceptions, outcomes] = await Promise.all([
    fetchPaged<PharmacyRow>((from, to) => supabase.from('pharmacies').select('id, external_pharmacy_id, name').eq('dataset_id', datasetId).order('id').range(from, to)),
    fetchPaged<OrderForPharmacy>((from, to) => supabase.from('orders').select('id, pharmacy_id').eq('dataset_id', datasetId).order('id').range(from, to)),
    fetchPaged<ExceptionForPharmacy>((from, to) => supabase.from('order_exceptions').select('id, order_id, type, severity').eq('dataset_id', datasetId).order('id').range(from, to)),
    fetchPaged<EvaluatedOutcome>((from, to) => supabase.from('order_outcomes').select('order_id').eq('dataset_id', datasetId).eq('outcome_final', true).order('order_id').range(from, to)),
  ]);
  const evaluatedOrderIds = new Set(outcomes.map((outcome) => outcome.order_id));

  // Re-map exceptions by orderId for efficient lookup
  const exceptionsByOrderId = new Map<string, ExceptionForPharmacy[]>();
  for (const exc of exceptions) {
    const list = exceptionsByOrderId.get(exc.order_id) ?? [];
    list.push(exc);
    exceptionsByOrderId.set(exc.order_id, list);
  }

  return pharmacies.map((pharmacy) => {
    const allPharmacyOrders = orders
      .filter((o) => o.pharmacy_id === pharmacy.id)
      .map((o) => ({ orderId: o.id }));
    const pharmacyOrders = allPharmacyOrders.filter((order) => evaluatedOrderIds.has(order.orderId));
    const pharmacyExceptions = pharmacyOrders.flatMap((o) =>
      (exceptionsByOrderId.get(o.orderId) ?? []).map((exc) => ({
        orderId: exc.order_id,
        type: exc.type,
        severity: exc.severity,
      }))
    );
    const derivedRisk = evaluatePharmacyServiceRisk(pharmacy.id, pharmacyOrders, pharmacyExceptions);
    const risk = {
      ...derivedRisk,
      totalOrders: allPharmacyOrders.length,
      evaluatedOrders: pharmacyOrders.length,
    };
    return { pharmacy, risk };
  });
}

export async function getPharmacyReadModel(datasetId: string, pharmacyId: string) {
  const supabase = getSupabaseServerClient();
  const { data: pharmacy, error: pharmacyError } = await supabase
    .from('pharmacies')
    .select('id, external_pharmacy_id, name')
    .eq('dataset_id', datasetId)
    .eq('id', pharmacyId)
    .maybeSingle();
  if (pharmacyError) throw pharmacyError;
  if (!pharmacy) return null;

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, external_order_id, status, placed_at')
    .eq('dataset_id', datasetId)
    .eq('pharmacy_id', pharmacyId)
    .order('placed_at', { ascending: false });
  if (ordersError) throw ordersError;

  const orderRows = orders ?? [];
  const orderIds = orderRows.map((order) => order.id);
  const exceptions = orderIds.length > 0
    ? await fetchPaged<ExceptionBase>((from, to) => supabase
        .from('order_exceptions')
        .select('id, order_id, supplier_id, product_id, type, severity, evidence_json, detected_at, engine_version')
        .eq('dataset_id', datasetId)
        .in('order_id', orderIds)
        .order('detected_at', { ascending: false })
        .range(from, to))
    : [];
  const evaluatedOutcomes = orderIds.length > 0
    ? await fetchPaged<{ order_id: string }>((from, to) => supabase
        .from('order_outcomes')
        .select('order_id')
        .eq('dataset_id', datasetId)
        .eq('outcome_final', true)
        .in('order_id', orderIds)
        .order('order_id')
        .range(from, to))
    : [];
  const evaluatedOrderIds = new Set(evaluatedOutcomes.map((outcome) => outcome.order_id));

  const supplierIds = [...new Set(
    exceptions.map((exception) => exception.supplier_id).filter((id): id is string => Boolean(id))
  )];
  const { data: suppliers, error: suppliersError } = supplierIds.length > 0
    ? await supabase
        .from('suppliers')
        .select('id, external_supplier_id, name')
        .eq('dataset_id', datasetId)
        .in('id', supplierIds)
    : { data: [], error: null };
  if (suppliersError) throw suppliersError;

  const supplierMap = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier]));
  const exceptionsByOrder = new Map<string, ExceptionBase[]>();
  const exceptionCountsBySupplier = new Map<string, number>();
  for (const exception of exceptions) {
    const list = exceptionsByOrder.get(exception.order_id) ?? [];
    list.push(exception);
    exceptionsByOrder.set(exception.order_id, list);
    if (exception.supplier_id) {
      exceptionCountsBySupplier.set(
        exception.supplier_id,
        (exceptionCountsBySupplier.get(exception.supplier_id) ?? 0) + 1
      );
    }
  }

  const derivedRisk = evaluatePharmacyServiceRisk(
    pharmacy.id,
    orderRows.filter((order) => evaluatedOrderIds.has(order.id)).map((order) => ({ orderId: order.id })),
    exceptions.map((exception) => ({
      orderId: exception.order_id,
      type: exception.type,
      severity: exception.severity,
    }))
  );
  const risk = {
    ...derivedRisk,
    totalOrders: orderRows.length,
    evaluatedOrders: evaluatedOrderIds.size,
  };

  return {
    pharmacy,
    risk,
    topProblematicSuppliers: [...exceptionCountsBySupplier.entries()]
      .sort(([, left], [, right]) => right - left)
      .slice(0, 5)
      .map(([supplierId, exceptionCount]) => ({
        supplier: supplierMap.get(supplierId) ?? null,
        exceptionCount,
      })),
    recentAffectedOrders: orderRows
      .filter((order) => exceptionsByOrder.has(order.id))
      .slice(0, 20)
      .map((order) => ({
        order,
        exceptions: (exceptionsByOrder.get(order.id) ?? []).map((exception) => ({
          id: exception.id,
          type: exception.type,
          severity: exception.severity,
          evidence: exception.evidence_json,
          supplier: exception.supplier_id ? supplierMap.get(exception.supplier_id) ?? null : null,
        })),
      })),
  };
}

async function loadOrderReadSource(datasetId: string, orderId?: string) {
  const supabase = getSupabaseServerClient();
  const [orders, pharmacies, suppliers, items, outcomes, exceptions] = await Promise.all([
    fetchPaged<OrderBase>((from, to) => {
      let query = supabase.from('orders').select('id, external_order_id, pharmacy_id, status, placed_at').eq('dataset_id', datasetId);
      if (orderId) query = query.eq('id', orderId);
      return query.order('placed_at', { ascending: false }).order('id').range(from, to);
    }),
    fetchPaged<PharmacyBase>((from, to) => supabase.from('pharmacies').select('id, external_pharmacy_id, name').eq('dataset_id', datasetId).order('id').range(from, to)),
    fetchPaged<SupplierBase>((from, to) => supabase.from('suppliers').select('id, external_supplier_id, name').eq('dataset_id', datasetId).order('id').range(from, to)),
    fetchPaged<ItemBase>((from, to) => {
      let query = supabase.from('order_items').select('id, order_id, product_id, requested_qty, unit').eq('dataset_id', datasetId);
      if (orderId) query = query.eq('order_id', orderId);
      return query.order('id').range(from, to);
    }),
    fetchPaged<OutcomeBase>((from, to) => {
      let query = supabase.from('order_outcomes').select('id, order_id, supplier_id, product_id, filled_qty, delivered_at, cancelled, cancellation_reason, outcome_final').eq('dataset_id', datasetId);
      if (orderId) query = query.eq('order_id', orderId);
      return query.order('id').range(from, to);
    }),
    fetchPaged<ExceptionBase>((from, to) => {
      let query = supabase.from('order_exceptions').select('id, order_id, supplier_id, product_id, type, severity, evidence_json, detected_at, engine_version').eq('dataset_id', datasetId);
      if (orderId) query = query.eq('order_id', orderId);
      return query.order('id').range(from, to);
    }),
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

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    const group = result.get(groupKey) ?? [];
    group.push(value);
    result.set(groupKey, group);
  }
  return result;
}

async function fetchProductSnapshots(
  supabase: SupabaseClient<Database>,
  datasetId: string,
  supplierId: string
): Promise<ProductSnapshotRow[]> {
  const rows: ProductSnapshotRow[] = [];
  const PAGE_SIZE_LOCAL = 1_000;
  for (let from = 0; ; from += PAGE_SIZE_LOCAL) {
    const { data, error } = await supabase
      .from('supplier_product_reliability_snapshots')
      .select('*')
      .eq('dataset_id', datasetId)
      .eq('supplier_id', supplierId)
      .order('as_of_date', { ascending: false })
      .order('id')
      .range(from, from + PAGE_SIZE_LOCAL - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE_LOCAL) return rows;
  }
}
