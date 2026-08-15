import { evaluateOrderExceptions } from '@cluster/core/exceptions/evaluate';
import type { OperationalEvaluationInput } from '@cluster/core/exceptions/types';
import { evaluateSupplierReliability } from '@cluster/core/supplier/deterioration';
import { buildSupplierOrderObservations } from '@cluster/core/supplier/observations';
import { evaluateSupplierProductReliability } from '@cluster/core/supplier/product-reliability';
import { calculatePromiseRiskMetrics } from '@cluster/core/supplier/promise-risk';
import { PHASE4_ENGINE_VERSION } from '@cluster/core/supplier/policy-v1';
import type { PostgrestError } from '@supabase/supabase-js';
import { getDatasetById } from '../db/repositories/datasets';
import {
  replaceOrderExceptions,
  upsertSupplierReliabilitySnapshots,
  upsertSupplierReliabilitySnapshotsWithPromiseRisk,
} from '../db/repositories/operations';
import { upsertSupplierProductSnapshots } from '../db/repositories/product-reliability';
import { getSupabaseServerClient } from '../supabase/server';

interface SourceRows extends OperationalEvaluationInput {
  supplierIds: string[];
}

export interface DatasetEvaluationSummary {
  datasetId: string;
  asOf: string;
  engineVersion: string;
  ordersLoaded: number;
  observationsEvaluated: number;
  exceptionsPersisted: number;
  suppliersEvaluated: number;
  suppliersByStatus: Record<'HEALTHY' | 'WATCH' | 'HIGH' | 'INSUFFICIENT_DATA', number>;
  diagnostics: Record<string, number>;
  timingsMs: {
    load: number;
    observationConstruction: number;
    exceptionEvaluation: number;
    supplierCalculations: number;
    persistence: number;
    total: number;
  };
}

export async function evaluateDatasetOperations(
  datasetId: string,
  asOf = new Date().toISOString()
): Promise<DatasetEvaluationSummary> {
  const totalStarted = performance.now();
  const dataset = await getDatasetById(datasetId);
  if (!dataset) throw new Error('Dataset not found.');
  const normalizedAsOf = normalizeAsOf(asOf);

  const loadStarted = performance.now();
  const source = await loadOperationalSource(datasetId);
  const load = elapsed(loadStarted);

  const exceptionStarted = performance.now();
  const exceptionResult = evaluateOrderExceptions(source);
  const exceptionEvaluation = elapsed(exceptionStarted);

  const observationStarted = performance.now();
  const observationResult = buildSupplierOrderObservations(source);
  const observationConstruction = elapsed(observationStarted);

  const supplierStarted = performance.now();
  const supplierEvaluations = source.supplierIds.map((supplierId) =>
    evaluateSupplierReliability(
      datasetId,
      supplierId,
      observationResult.observations,
      normalizedAsOf
    )
  );

  // Per-supplier promise risk metrics (uses same observations)
  const promiseRiskBySupplier = new Map(
    source.supplierIds.map((supplierId) => [
      supplierId,
      calculatePromiseRiskMetrics(
        observationResult.observations.filter((obs) => obs.supplierId === supplierId)
      ),
    ])
  );

  // Per-supplier × per-product reliability evaluations
  const productPairs = [...new Set(
    observationResult.observations.flatMap((obs) =>
      obs.productIds.map((productId) => `${obs.supplierId}\x00${productId}`)
    )
  )].map((key) => {
    const [supplierId, productId] = key.split('\x00') as [string, string];
    return { supplierId, productId };
  });

  const productEvaluations = productPairs.map(({ supplierId, productId }) =>
    evaluateSupplierProductReliability(
      datasetId,
      supplierId,
      productId,
      observationResult.observations,
      normalizedAsOf
    )
  );
  const supplierCalculations = elapsed(supplierStarted);

  const persistenceStarted = performance.now();
  const [exceptions] = await Promise.all([
    replaceOrderExceptions(
      datasetId,
      PHASE4_ENGINE_VERSION,
      normalizedAsOf,
      exceptionResult.exceptions
    ),
    upsertSupplierReliabilitySnapshotsWithPromiseRisk(
      supplierEvaluations,
      promiseRiskBySupplier,
      PHASE4_ENGINE_VERSION,
      normalizedAsOf
    ),
    upsertSupplierProductSnapshots(productEvaluations, normalizedAsOf),
  ]);
  const persistence = elapsed(persistenceStarted);
  const allDiagnostics = [...exceptionResult.diagnostics, ...observationResult.diagnostics];

  return {
    datasetId,
    asOf: normalizedAsOf,
    engineVersion: PHASE4_ENGINE_VERSION,
    ordersLoaded: source.orders.length,
    observationsEvaluated: observationResult.observations.length,
    exceptionsPersisted: exceptions.length,
    suppliersEvaluated: supplierEvaluations.length,
    suppliersByStatus: {
      HEALTHY: supplierEvaluations.filter((value) => value.status === 'HEALTHY').length,
      WATCH: supplierEvaluations.filter((value) => value.status === 'WATCH').length,
      HIGH: supplierEvaluations.filter((value) => value.status === 'HIGH').length,
      INSUFFICIENT_DATA: supplierEvaluations.filter((value) => value.status === 'INSUFFICIENT_DATA').length,
    },
    diagnostics: countDiagnostics(allDiagnostics.map((value) => value.code)),
    timingsMs: {
      load,
      observationConstruction,
      exceptionEvaluation,
      supplierCalculations,
      persistence,
      total: elapsed(totalStarted),
    },
  };
}

async function loadOperationalSource(datasetId: string): Promise<SourceRows> {
  const supabase = getSupabaseServerClient();
  const [orders, items, outcomes, offers, decisions, suppliers] = await Promise.all([
    fetchPaged((from, to) => supabase.from('orders').select('id, dataset_id, placed_at').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged((from, to) => supabase.from('order_items').select('id, order_id, product_id, requested_qty').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged((from, to) => supabase.from('order_outcomes').select('id, order_id, supplier_id, product_id, filled_qty, delivered_at, cancelled, outcome_final').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged((from, to) => supabase.from('supplier_offers').select('id, order_id, supplier_id, product_id, promised_delivery_at, offered_at').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged((from, to) => supabase.from('ai_decisions').select('id, order_id, selected_supplier_id, decided_at').eq('dataset_id', datasetId).range(from, to)),
    fetchPaged((from, to) => supabase.from('suppliers').select('id').eq('dataset_id', datasetId).range(from, to)),
  ]);
  return {
    orders: orders.map((value) => ({ id: value.id, datasetId: value.dataset_id, placedAt: value.placed_at })),
    items: items.map((value) => ({ id: value.id, orderId: value.order_id, productId: value.product_id, requestedQty: value.requested_qty })),
    outcomes: outcomes.map((value) => ({
      id: value.id,
      orderId: value.order_id,
      supplierId: value.supplier_id,
      productId: value.product_id,
      filledQty: value.filled_qty,
      deliveredAt: value.delivered_at,
      cancelled: value.cancelled,
      outcomeFinal: value.outcome_final,
    })),
    offers: offers.map((value) => ({
      id: value.id,
      orderId: value.order_id,
      supplierId: value.supplier_id,
      productId: value.product_id,
      promisedDeliveryAt: value.promised_delivery_at,
      offeredAt: value.offered_at,
    })),
    decisions: decisions.map((value) => ({
      id: value.id,
      orderId: value.order_id,
      selectedSupplierId: value.selected_supplier_id,
      decidedAt: value.decided_at,
    })),
    supplierIds: suppliers.map((value) => value.id),
  };
}

const PAGE_SIZE = 1_000;

async function fetchPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: PostgrestError | null;
  }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function normalizeAsOf(input: string): string {
  const value = Date.parse(input);
  if (!Number.isFinite(value)) throw new Error('asOf must be a valid timestamp.');
  return new Date(value).toISOString();
}

function countDiagnostics(codes: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const code of codes) counts[code] = (counts[code] ?? 0) + 1;
  return counts;
}

function elapsed(started: number): number {
  return Math.round((performance.now() - started) * 100) / 100;
}
