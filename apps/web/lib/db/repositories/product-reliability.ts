import { getSupabaseServerClient } from '../../supabase/server';
import type { Json } from '../generated-types';
import type { SupplierProductReliabilityEvaluation } from '@cluster/core/supplier/types';
import { PHASE4_ENGINE_VERSION } from '@cluster/core/supplier/policy-v1';

export interface SupplierProductSnapshotRow {
  id: string;
  dataset_id: string;
  supplier_id: string;
  product_id: string;
  as_of_date: string;
  recent_window_days: number;
  baseline_window_days: number;
  recent_evaluated_orders: number;
  baseline_evaluated_orders: number;
  recent_fill_rate_bps: number | null;
  baseline_fill_rate_bps: number | null;
  recent_otif_rate_bps: number | null;
  baseline_otif_rate_bps: number | null;
  recent_cancellation_rate_bps: number | null;
  baseline_cancellation_rate_bps: number | null;
  recent_partial_fill_rate_bps: number | null;
  baseline_partial_fill_rate_bps: number | null;
  recent_lead_time_p50_minutes: number | null;
  recent_lead_time_p95_minutes: number | null;
  baseline_lead_time_p95_minutes: number | null;
  status: string;
  triggers_json: unknown;
  engine_version: string;
  computed_at: string;
  created_at: string;
}

const WRITE_BATCH_SIZE = 400;

export async function upsertSupplierProductSnapshots(
  evaluations: SupplierProductReliabilityEvaluation[],
  computedAt: string
): Promise<SupplierProductSnapshotRow[]> {
  const supabase = getSupabaseServerClient();
  const persisted: SupplierProductSnapshotRow[] = [];
  for (let index = 0; index < evaluations.length; index += WRITE_BATCH_SIZE) {
    const batch = evaluations.slice(index, index + WRITE_BATCH_SIZE).map((value) => ({
      dataset_id: value.datasetId,
      supplier_id: value.supplierId,
      product_id: value.productId,
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
      engine_version: PHASE4_ENGINE_VERSION,
      computed_at: computedAt,
    }));
    const { data, error } = await supabase
      .from('supplier_product_reliability_snapshots' as never)
      .upsert(batch as never, {
        onConflict:
          'dataset_id,supplier_id,product_id,as_of_date,recent_window_days,baseline_window_days,engine_version',
      })
      .select('*');
    if (error) throw error;
    persisted.push(...((data as unknown as SupplierProductSnapshotRow[]) ?? []));
  }
  return persisted;
}

export async function listProductSnapshotsForSupplier(
  datasetId: string,
  supplierId: string
): Promise<SupplierProductSnapshotRow[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('supplier_product_reliability_snapshots' as never)
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('supplier_id', supplierId)
    .order('as_of_date', { ascending: false });
  if (error) throw error;
  return (data as unknown as SupplierProductSnapshotRow[]) ?? [];
}
