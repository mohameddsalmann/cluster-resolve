import type { Json } from '../generated-types';
import type { OrderException } from '@cluster/core/exceptions/types';
import type { SupplierReliabilityEvaluation } from '@cluster/core/supplier/types';
import { getSupabaseServerClient } from '../../supabase/server';
import type { OrderExceptionRow, SupplierReliabilitySnapshotRow } from '../row-types';

const WRITE_BATCH_SIZE = 400;

export async function replaceOrderExceptions(
  datasetId: string,
  engineVersion: string,
  detectedAt: string,
  exceptions: OrderException[]
): Promise<OrderExceptionRow[]> {
  const supabase = getSupabaseServerClient();
  const removed = await supabase
    .from('order_exceptions')
    .delete()
    .eq('dataset_id', datasetId)
    .eq('engine_version', engineVersion);
  if (removed.error) throw removed.error;

  const persisted: OrderExceptionRow[] = [];
  for (let index = 0; index < exceptions.length; index += WRITE_BATCH_SIZE) {
    const batch = exceptions.slice(index, index + WRITE_BATCH_SIZE).map((value) => ({
      dataset_id: datasetId,
      order_id: value.orderId,
      supplier_id: value.supplierId,
      product_id: value.productId,
      type: value.type,
      severity: value.severity,
      engine_version: engineVersion,
      evidence_json: value.evidence as Json,
      detected_at: detectedAt,
    }));
    const { data, error } = await supabase.from('order_exceptions').insert(batch).select('*');
    if (error) throw error;
    persisted.push(...(data ?? []));
  }
  return persisted;
}

export async function upsertSupplierReliabilitySnapshots(
  evaluations: SupplierReliabilityEvaluation[],
  engineVersion: string,
  computedAt: string
): Promise<SupplierReliabilitySnapshotRow[]> {
  const supabase = getSupabaseServerClient();
  const persisted: SupplierReliabilitySnapshotRow[] = [];
  for (let index = 0; index < evaluations.length; index += WRITE_BATCH_SIZE) {
    const batch = evaluations.slice(index, index + WRITE_BATCH_SIZE).map((value) => ({
      dataset_id: value.datasetId,
      supplier_id: value.supplierId,
      as_of_date: value.asOf.slice(0, 10),
      recent_window_days: value.recentWindowDays,
      baseline_window_days: value.baselineWindowDays,
      recent_evaluated_orders: value.recent.evaluatedOrders,
      baseline_evaluated_orders: value.baseline.evaluatedOrders,
      recent_fill_rate_bps: value.recent.fillRateBps,
      baseline_fill_rate_bps: value.baseline.fillRateBps,
      recent_otif_rate_bps: value.recent.otifRateBps,
      baseline_otif_rate_bps: value.baseline.otifRateBps,
      recent_cancellation_rate_bps: value.recent.cancellationRateBps,
      baseline_cancellation_rate_bps: value.baseline.cancellationRateBps,
      recent_partial_fill_rate_bps: value.recent.partialFillRateBps,
      baseline_partial_fill_rate_bps: value.baseline.partialFillRateBps,
      recent_lead_time_p50_minutes: value.recent.leadTimeP50Minutes,
      recent_lead_time_p95_minutes: value.recent.leadTimeP95Minutes,
      baseline_lead_time_p95_minutes: value.baseline.leadTimeP95Minutes,
      status: value.status,
      triggers_json: value.triggers as unknown as Json,
      engine_version: engineVersion,
      computed_at: computedAt,
    }));
    const { data, error } = await supabase
      .from('supplier_reliability_snapshots')
      .upsert(batch, {
        onConflict: 'dataset_id,supplier_id,as_of_date,recent_window_days,baseline_window_days,engine_version',
      })
      .select('*');
    if (error) throw error;
    persisted.push(...(data ?? []));
  }
  return persisted;
}

export async function upsertSupplierReliabilitySnapshotsWithPromiseRisk(
  evaluations: SupplierReliabilityEvaluation[],
  promiseRiskBySupplier: Map<string, import('@cluster/core/supplier/types').PromiseRiskMetrics>,
  engineVersion: string,
  computedAt: string
): Promise<SupplierReliabilitySnapshotRow[]> {
  const supabase = getSupabaseServerClient();
  const persisted: SupplierReliabilitySnapshotRow[] = [];
  for (let index = 0; index < evaluations.length; index += WRITE_BATCH_SIZE) {
    const batch = evaluations.slice(index, index + WRITE_BATCH_SIZE).map((value) => ({
      dataset_id: value.datasetId,
      supplier_id: value.supplierId,
      as_of_date: value.asOf.slice(0, 10),
      recent_window_days: value.recentWindowDays,
      baseline_window_days: value.baselineWindowDays,
      recent_evaluated_orders: value.recent.evaluatedOrders,
      baseline_evaluated_orders: value.baseline.evaluatedOrders,
      recent_fill_rate_bps: value.recent.fillRateBps,
      baseline_fill_rate_bps: value.baseline.fillRateBps,
      recent_otif_rate_bps: value.recent.otifRateBps,
      baseline_otif_rate_bps: value.baseline.otifRateBps,
      recent_cancellation_rate_bps: value.recent.cancellationRateBps,
      baseline_cancellation_rate_bps: value.baseline.cancellationRateBps,
      recent_partial_fill_rate_bps: value.recent.partialFillRateBps,
      baseline_partial_fill_rate_bps: value.baseline.partialFillRateBps,
      recent_lead_time_p50_minutes: value.recent.leadTimeP50Minutes,
      recent_lead_time_p95_minutes: value.recent.leadTimeP95Minutes,
      baseline_lead_time_p95_minutes: value.baseline.leadTimeP95Minutes,
      status: value.status,
      triggers_json: value.triggers as unknown as Json,
      engine_version: engineVersion,
      computed_at: computedAt,
      promise_risk_json: (promiseRiskBySupplier.get(value.supplierId) ?? {}) as unknown as Json,
    }));
    const { data, error } = await supabase
      .from('supplier_reliability_snapshots')
      .upsert(batch as never, {
        onConflict: 'dataset_id,supplier_id,as_of_date,recent_window_days,baseline_window_days,engine_version',
      })
      .select('*');
    if (error) throw error;
    persisted.push(...(data ?? []));
  }
  return persisted;
}


export async function listOrderExceptions(datasetId: string): Promise<OrderExceptionRow[]> {
  const { data, error } = await getSupabaseServerClient()
    .from('order_exceptions')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('detected_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listSupplierSnapshots(
  datasetId: string
): Promise<SupplierReliabilitySnapshotRow[]> {
  const { data, error } = await getSupabaseServerClient()
    .from('supplier_reliability_snapshots')
    .select('*')
    .eq('dataset_id', datasetId)
    .order('as_of_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
