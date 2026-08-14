import { calculateCoverage, type CoverageRatio } from '@cluster/core/ingestion/quality';
import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '../supabase/server';

interface IdRow { id: string }
interface ItemRow { order_id: string; product_id: string }
interface OutcomeRow { order_id: string; product_id: string; outcome_final: boolean }
interface DecisionRow { order_id: string; decided_at: string }
interface OfferRow { order_id: string; supplier_id: string; offered_at: string }
interface JobRow {
  id: string;
  kind: string;
  processed_rows: number;
  valid_rows: number;
  error_rows: number;
}
interface ErrorRow { job_id: string; code: string }

export interface DatasetQuality {
  datasetId: string;
  rows: { processed: number; accepted: number; rejected: number };
  rejectedReferences: {
    unknownOrders: number;
    unknownProducts: number;
    unknownSuppliers: number;
    attemptedOrphanOutcomes: number;
    attemptedDecisionsWithoutOrders: number;
  };
  coverage: {
    ordersWithFinalOutcomes: CoverageRatio;
    ordersReadyForPhase4: CoverageRatio;
    decisionsWithHistoricalOffers: CoverageRatio;
    decisionsWithComparativeOffers: CoverageRatio;
  };
}

const PAGE_SIZE = 1_000;

export async function getDatasetQuality(datasetId: string): Promise<DatasetQuality> {
  const supabase = getSupabaseServerClient();
  const [orders, items, outcomes, decisions, offers, jobs] = await Promise.all([
    fetchPaged<IdRow>((from, to) =>
      supabase.from('orders').select('id').eq('dataset_id', datasetId).range(from, to)
    ),
    fetchPaged<ItemRow>((from, to) =>
      supabase.from('order_items').select('order_id, product_id').eq('dataset_id', datasetId).range(from, to)
    ),
    fetchPaged<OutcomeRow>((from, to) =>
      supabase.from('order_outcomes').select('order_id, product_id, outcome_final').eq('dataset_id', datasetId).range(from, to)
    ),
    fetchPaged<DecisionRow>((from, to) =>
      supabase.from('ai_decisions').select('order_id, decided_at').eq('dataset_id', datasetId).range(from, to)
    ),
    fetchPaged<OfferRow>((from, to) =>
      supabase.from('supplier_offers').select('order_id, supplier_id, offered_at').eq('dataset_id', datasetId).range(from, to)
    ),
    fetchPaged<JobRow>((from, to) =>
      supabase.from('ingestion_jobs').select('id, kind, processed_rows, valid_rows, error_rows').eq('dataset_id', datasetId).range(from, to)
    ),
  ]);

  const errors = await fetchErrors(jobs.map((job) => job.id));
  return calculateDatasetQuality(datasetId, orders, items, outcomes, decisions, offers, jobs, errors);
}

export function calculateDatasetQuality(
  datasetId: string,
  orders: IdRow[],
  items: ItemRow[],
  outcomes: OutcomeRow[],
  decisions: DecisionRow[],
  offers: OfferRow[],
  jobs: JobRow[],
  errors: ErrorRow[]
): DatasetQuality {
  const itemsByOrder = groupBy(items, (item) => item.order_id);
  const finalProductsByOrder = new Map<string, Set<string>>();
  for (const outcome of outcomes) {
    if (!outcome.outcome_final) continue;
    const products = finalProductsByOrder.get(outcome.order_id) ?? new Set<string>();
    products.add(outcome.product_id);
    finalProductsByOrder.set(outcome.order_id, products);
  }

  const withAnyFinal = orders.filter((order) => (finalProductsByOrder.get(order.id)?.size ?? 0) > 0).length;
  const ready = orders.filter((order) => {
    const orderItems = itemsByOrder.get(order.id) ?? [];
    const finalProducts = finalProductsByOrder.get(order.id) ?? new Set<string>();
    return orderItems.length > 0 && orderItems.every((item) => finalProducts.has(item.product_id));
  }).length;

  let historical = 0;
  let comparative = 0;
  const offersByOrder = groupBy(offers, (offer) => offer.order_id);
  for (const decision of decisions) {
    const suppliers = new Set(
      (offersByOrder.get(decision.order_id) ?? [])
        .filter((offer) => Date.parse(offer.offered_at) <= Date.parse(decision.decided_at))
        .map((offer) => offer.supplier_id)
    );
    if (suppliers.size > 0) historical += 1;
    if (suppliers.size >= 2) comparative += 1;
  }

  const jobKinds = new Map(jobs.map((job) => [job.id, job.kind]));
  const countCode = (code: string) => errors.filter((error) => error.code === code).length;
  const attemptedOrphanOutcomes = errors.filter(
    (error) => error.code === 'UNKNOWN_ORDER' && jobKinds.get(error.job_id) === 'OUTCOMES'
  ).length;
  const attemptedDecisionsWithoutOrders = errors.filter(
    (error) => error.code === 'UNKNOWN_ORDER' && jobKinds.get(error.job_id) === 'DECISIONS'
  ).length;

  return {
    datasetId,
    rows: {
      processed: jobs.reduce((sum, job) => sum + job.processed_rows, 0),
      accepted: jobs.reduce((sum, job) => sum + job.valid_rows, 0),
      rejected: jobs.reduce((sum, job) => sum + job.error_rows, 0),
    },
    rejectedReferences: {
      unknownOrders: countCode('UNKNOWN_ORDER'),
      unknownProducts: countCode('UNKNOWN_PRODUCT'),
      unknownSuppliers: countCode('UNKNOWN_SUPPLIER'),
      attemptedOrphanOutcomes,
      attemptedDecisionsWithoutOrders,
    },
    coverage: {
      ordersWithFinalOutcomes: calculateCoverage(withAnyFinal, orders.length),
      ordersReadyForPhase4: calculateCoverage(ready, orders.length),
      decisionsWithHistoricalOffers: calculateCoverage(historical, decisions.length),
      decisionsWithComparativeOffers: calculateCoverage(comparative, decisions.length),
    },
  };
}

async function fetchErrors(jobIds: string[]): Promise<ErrorRow[]> {
  const errors: ErrorRow[] = [];
  const supabase = getSupabaseServerClient();
  for (let index = 0; index < jobIds.length; index += 100) {
    const ids = jobIds.slice(index, index + 100);
    if (ids.length === 0) continue;
    errors.push(
      ...(await fetchPaged<ErrorRow>((from, to) =>
        supabase
          .from('ingestion_errors')
          .select('job_id, code')
          .in('job_id', ids)
          .range(from, to)
      ))
    );
  }
  return errors;
}

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

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return groups;
}
