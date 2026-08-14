import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PHASE4_ENGINE_VERSION } from '@cluster/core/supplier/policy-v1';
import { createDataset } from '../../lib/db/repositories/datasets';
import { evaluateDatasetOperations } from '../../lib/operations/evaluate';
import { getOrderReadModel, getSupplierReadModel } from '../../lib/operations/read-models';
import { getSupabaseServerClient } from '../../lib/supabase/server';
import {
  PHASE4_AS_OF,
  cleanupPhase4Dataset,
  seedPhase4Scenario,
  type Phase4Scenario,
} from '../fixtures/phase4-scenario';

describe('Database Integration — Phase 4 Operational Reliability', () => {
  let scenario: Phase4Scenario;
  let importedRealDatasetId: string;

  beforeAll(async () => {
    requireHostedEnvironment();
    scenario = await seedPhase4Scenario();
    importedRealDatasetId = (await createDataset({
      name: 'Phase 4 Dataset Isolation',
      mode: 'IMPORTED_REAL',
    })).id;
  }, 120_000);

  afterAll(async () => {
    if (scenario?.datasetId) await cleanupPhase4Dataset(scenario.datasetId);
    if (importedRealDatasetId) {
      const { error } = await getSupabaseServerClient().from('datasets').delete().eq('id', importedRealDatasetId);
      if (error) throw error;
    }
  }, 120_000);

  it('persists exceptions and supplier snapshots from real SAMPLE source rows', async () => {
    const summary = await evaluateDatasetOperations(scenario.datasetId, PHASE4_AS_OF);
    expect(summary.engineVersion).toBe(PHASE4_ENGINE_VERSION);
    expect(summary.observationsEvaluated).toBe(62);
    expect(summary.suppliersByStatus).toEqual({ HEALTHY: 1, WATCH: 0, HIGH: 1, INSUFFICIENT_DATA: 1 });

    const supabase = getSupabaseServerClient();
    const [partial, exceptionTypes, deteriorating, lowSample, affected] = await Promise.all([
      supabase.from('order_exceptions').select('*').eq('dataset_id', scenario.datasetId).eq('order_id', scenario.orderIds.partial).eq('type', 'PARTIAL_FILL').single(),
      supabase.from('order_exceptions').select('type').eq('dataset_id', scenario.datasetId),
      supabase.from('supplier_reliability_snapshots').select('*').eq('dataset_id', scenario.datasetId).eq('supplier_id', scenario.supplierIds.deteriorating).single(),
      supabase.from('supplier_reliability_snapshots').select('*').eq('dataset_id', scenario.datasetId).eq('supplier_id', scenario.supplierIds.lowSample).single(),
      supabase.from('orders').select('id, external_order_id').eq('dataset_id', scenario.datasetId).like('external_order_id', 'P4-DET-R-%').order('external_order_id'),
    ]);
    for (const result of [partial, exceptionTypes, deteriorating, lowSample, affected]) {
      if (result.error) throw result.error;
    }
    if (!partial.data || !deteriorating.data || !lowSample.data) {
      throw new Error('Phase 4 persisted acceptance evidence is missing.');
    }
    expect(new Set(exceptionTypes.data?.map((value) => value.type))).toEqual(
      new Set(['PARTIAL_FILL', 'CANCELLED', 'UNFULFILLED', 'LATE_DELIVERY'])
    );
    expect(partial.data.evidence_json).toMatchObject({
      requested_qty: 10,
      filled_qty: 5,
      outcome_id: scenario.outcomeIds.partial,
    });
    expect(deteriorating.data).toMatchObject({
      status: 'HIGH',
      recent_fill_rate_bps: scenario.expected.deterioratingRecentFillBps,
      baseline_fill_rate_bps: scenario.expected.deterioratingBaselineFillBps,
      recent_otif_rate_bps: scenario.expected.deterioratingRecentOtifBps,
      baseline_otif_rate_bps: scenario.expected.deterioratingBaselineOtifBps,
    });
    expect(lowSample.data.status).toBe('INSUFFICIENT_DATA');
    expect(lowSample.data.recent_evaluated_orders).toBe(2);
    expect(lowSample.data.baseline_evaluated_orders).toBe(0);

    console.info(`PHASE4_FOUNDER_SCENARIO_1 ${JSON.stringify({
      orderId: scenario.orderIds.partial,
      type: partial.data.type,
      evidence: partial.data.evidence_json,
    })}`);
    console.info(`PHASE4_FOUNDER_SCENARIO_2 ${JSON.stringify({
      supplierId: scenario.supplierIds.deteriorating,
      fill: { baselineBps: deteriorating.data.baseline_fill_rate_bps, recentBps: deteriorating.data.recent_fill_rate_bps },
      otif: { baselineBps: deteriorating.data.baseline_otif_rate_bps, recentBps: deteriorating.data.recent_otif_rate_bps },
      status: deteriorating.data.status,
      triggers: deteriorating.data.triggers_json,
      affectedOrders: affected.data?.map((value) => value.external_order_id),
    })}`);
    console.info(`PHASE4_FOUNDER_SCENARIO_3 ${JSON.stringify({
      supplierId: scenario.supplierIds.lowSample,
      recentOrders: lowSample.data.recent_evaluated_orders,
      baselineOrders: lowSample.data.baseline_evaluated_orders,
      status: lowSample.data.status,
      triggers: lowSample.data.triggers_json,
    })}`);
  }, 120_000);

  it('reruns idempotently and upserts the same snapshot identity', async () => {
    const supabase = getSupabaseServerClient();
    const beforeExceptions = await supabase.from('order_exceptions').select('id', { count: 'exact' }).eq('dataset_id', scenario.datasetId);
    const beforeSnapshot = await supabase.from('supplier_reliability_snapshots').select('id').eq('dataset_id', scenario.datasetId).eq('supplier_id', scenario.supplierIds.deteriorating).single();
    if (beforeExceptions.error) throw beforeExceptions.error;
    if (beforeSnapshot.error) throw beforeSnapshot.error;

    await evaluateDatasetOperations(scenario.datasetId, PHASE4_AS_OF);
    const afterExceptions = await supabase.from('order_exceptions').select('id', { count: 'exact' }).eq('dataset_id', scenario.datasetId);
    const afterSnapshot = await supabase.from('supplier_reliability_snapshots').select('id').eq('dataset_id', scenario.datasetId).eq('supplier_id', scenario.supplierIds.deteriorating).single();
    if (afterExceptions.error) throw afterExceptions.error;
    if (afterSnapshot.error) throw afterSnapshot.error;
    expect(afterExceptions.count).toBe(beforeExceptions.count);
    expect(afterSnapshot.data.id).toBe(beforeSnapshot.data.id);
  }, 120_000);

  it('links evidence and read models to real source records only', async () => {
    const supabase = getSupabaseServerClient();
    const exception = await supabase.from('order_exceptions').select('*').eq('dataset_id', scenario.datasetId).eq('order_id', scenario.orderIds.partial).eq('type', 'PARTIAL_FILL').single();
    if (exception.error) throw exception.error;
    const evidence = exception.data.evidence_json as { outcome_id: string };
    const outcome = await supabase.from('order_outcomes').select('id, order_id, supplier_id, product_id').eq('dataset_id', scenario.datasetId).eq('id', evidence.outcome_id).single();
    if (outcome.error) throw outcome.error;
    expect(outcome.data).toMatchObject({
      order_id: exception.data.order_id,
      supplier_id: exception.data.supplier_id,
      product_id: exception.data.product_id,
    });

    const orderRead = await getOrderReadModel(scenario.datasetId, scenario.orderIds.partial);
    const supplierRead = await getSupplierReadModel(scenario.datasetId, scenario.supplierIds.deteriorating);
    expect(orderRead?.exceptions.some((value) => value.type === 'PARTIAL_FILL')).toBe(true);
    expect(supplierRead?.latestReliability?.status).toBe('HIGH');
    expect(supplierRead?.affectedOrders.length).toBeGreaterThan(0);
  }, 120_000);

  it('enforces dataset isolation for exceptions and snapshots', async () => {
    const supabase = getSupabaseServerClient();
    const exception = await supabase.from('order_exceptions').insert({
      dataset_id: importedRealDatasetId,
      order_id: scenario.orderIds.partial,
      supplier_id: scenario.supplierIds.deteriorating,
      type: 'PARTIAL_FILL',
      severity: 'MEDIUM',
      engine_version: PHASE4_ENGINE_VERSION,
      evidence_json: {},
      detected_at: PHASE4_AS_OF,
    });
    expect(exception.error?.code).toBe('23503');

    const snapshot = await supabase.from('supplier_reliability_snapshots').insert({
      dataset_id: importedRealDatasetId,
      supplier_id: scenario.supplierIds.deteriorating,
      as_of_date: '2026-08-14',
      recent_window_days: 14,
      baseline_window_days: 28,
      recent_evaluated_orders: 0,
      baseline_evaluated_orders: 0,
      status: 'INSUFFICIENT_DATA',
      triggers_json: [],
      engine_version: PHASE4_ENGINE_VERSION,
      computed_at: PHASE4_AS_OF,
    });
    expect(snapshot.error?.code).toBe('23503');
  }, 60_000);
});

function requireHostedEnvironment(): void {
  if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is required. Hosted DB tests MUST NOT skip silently.');
  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required. Hosted DB tests MUST NOT skip silently.');
  }
}
