import {
  discountPercentToBps,
  normalizeConfidence,
  normalizeIsoTimestamp,
  parseNonNegativeInteger,
  parseStrictBoolean,
} from '@cluster/core/ingestion/values';
import { normalizeName } from '@cluster/core/util/normalize';
import { toPiastres } from '@cluster/core/util/money';
import {
  decisionImportRowSchema,
  offerImportRowSchema,
  outcomeImportRowSchema,
  type DecisionImportRow,
  type OfferImportRow,
  type OutcomeImportRow,
} from '@cluster/schemas/imports';
import type { Database } from '../db/generated-types';
import { updateImportJobProgress } from '../db/repositories/ingestion-jobs';
import { getSupabaseServerClient } from '../supabase/server';
import type { ParsedCsvRow } from './csv';
import { type IngestionRowError, zodErrorsToRows } from './errors';

type Inserts = Database['public']['Tables'];

export interface BatchedImportResult {
  accepted: number;
  errors: IngestionRowError[];
  validationMs: number;
  persistenceMs: number;
}

// ── 1. BATCHED OFFERS IMPORT ──────────────────────────────────────────────────

interface NormalizedOfferRow {
  row: ParsedCsvRow;
  value: OfferImportRow;
  availableQty: number;
  priceMinor: bigint;
  discountBps: number;
  offeredAt: string;
  promisedAt: string | null;
}

export async function importOfferRowsBatched(
  datasetId: string,
  jobId: string,
  rows: ParsedCsvRow[]
): Promise<BatchedImportResult> {
  const validationStarted = performance.now();
  const errorsByRow = new Map<number, IngestionRowError[]>();
  const normalized: NormalizedOfferRow[] = [];

  for (const row of rows) {
    const parsed = offerImportRowSchema.safeParse(row.values);
    if (!parsed.success) {
      errorsByRow.set(row.rowNumber, zodErrorsToRows(parsed.error, row.rowNumber, row.values));
      continue;
    }
    try {
      const price = toPiastres(parsed.data.unit_price_egp);
      if (price > 9_223_372_036_854_775_807n) {
        throw new Error('Money exceeds BIGINT range.');
      }
      normalized.push({
        row,
        value: parsed.data,
        availableQty: parseNonNegativeInteger(parsed.data.available_qty, 'available_qty'),
        priceMinor: price,
        discountBps: discountPercentToBps(parsed.data.discount_percent),
        offeredAt: normalizeIsoTimestamp(parsed.data.offered_at),
        promisedAt: parsed.data.promised_delivery_at
          ? normalizeIsoTimestamp(parsed.data.promised_delivery_at)
          : null,
      });
    } catch (error) {
      const field = priceFailed(parsed.data.unit_price_egp) ? 'unit_price_egp' : 'offered_at';
      reject(errorsByRow, row, field, field === 'unit_price_egp' ? 'INVALID_MONEY' : 'INVALID_TIMESTAMP', error instanceof Error ? error.message : 'Invalid value.');
    }
  }
  markOfferInFileConflicts(normalized, errorsByRow);

  const validationMs = elapsed(validationStarted);
  const persistenceStarted = performance.now();
  const active = () => normalized.filter((entry) => !errorsByRow.has(entry.row.rowNumber));

  // Resolve Orders, Products, Suppliers
  const orderExternalIds = unique(active().map((e) => e.value.order_id));
  const productExternalIds = unique(active().map((e) => e.value.product_id));
  const supplierExternalIds = unique(active().map((e) => e.value.supplier_id));

  const [ordersMap, productsMap, suppliersMap] = await Promise.all([
    fetchMap('orders', 'external_order_id', orderExternalIds, datasetId),
    fetchMap('products', 'external_product_id', productExternalIds, datasetId),
    fetchMap('suppliers', 'external_supplier_id', supplierExternalIds, datasetId),
  ]);
  console.log(`[offers] preload references complete (${ordersMap.size} orders, ${productsMap.size} products, ${suppliersMap.size} suppliers)`);

  // Auto-create missing suppliers if they have a name
  const missingSuppliers = supplierExternalIds.filter((id) => !suppliersMap.has(id));
  if (missingSuppliers.length > 0) {
    const supplierInserts = uniqueBy(
      active()
        .filter((e) => !suppliersMap.has(e.value.supplier_id))
        .map((e): Inserts['suppliers']['Insert'] => ({
          dataset_id: datasetId,
          external_supplier_id: e.value.supplier_id,
          name: e.value.supplier_name,
          name_normalized: normalizeName(e.value.supplier_name),
          source_ingestion_job_id: jobId,
        })),
      (e) => e.external_supplier_id
    );
    await upsertBatches('suppliers', supplierInserts, 'dataset_id,external_supplier_id');
    const reloadedSuppliers = await fetchMap('suppliers', 'external_supplier_id', supplierExternalIds, datasetId);
    for (const [k, v] of reloadedSuppliers.entries()) suppliersMap.set(k, v);
  }

  for (const entry of active()) {
    if (!ordersMap.has(entry.value.order_id)) {
      reject(errorsByRow, entry.row, 'order_id', 'CROSS_DATASET_REFERENCE', 'The order does not exist in this dataset.');
    }
    if (!productsMap.has(entry.value.product_id)) {
      reject(errorsByRow, entry.row, 'product_id', 'CROSS_DATASET_REFERENCE', 'The product does not exist in this dataset.');
    }
    if (!suppliersMap.has(entry.value.supplier_id)) {
      reject(errorsByRow, entry.row, 'supplier_id', 'CROSS_DATASET_REFERENCE', 'The supplier does not exist in this dataset.');
    }
  }

  const offerInserts = active().map((entry): Inserts['supplier_offers']['Insert'] => ({
    dataset_id: datasetId,
    external_offer_id: entry.value.offer_id,
    order_id: ordersMap.get(entry.value.order_id)!.id,
    product_id: productsMap.get(entry.value.product_id)!.id,
    supplier_id: suppliersMap.get(entry.value.supplier_id)!.id,
    available_qty: entry.availableQty,
    unit_price_minor: Number(entry.priceMinor),
    discount_bps: entry.discountBps,
    promised_delivery_at: entry.promisedAt,
    offered_at: entry.offeredAt,
    source_ingestion_job_id: jobId,
  }));

  await upsertBatches('supplier_offers', offerInserts, 'dataset_id,external_offer_id', {
    jobId,
    label: 'offers',
  });

  const allErrors: IngestionRowError[] = [];
  for (const errs of errorsByRow.values()) allErrors.push(...errs);

  return {
    accepted: offerInserts.length,
    errors: allErrors,
    validationMs,
    persistenceMs: elapsed(persistenceStarted),
  };
}

// ── 2. BATCHED DECISIONS IMPORT ───────────────────────────────────────────────

interface NormalizedDecisionRow {
  row: ParsedCsvRow;
  value: DecisionImportRow;
  decidedAt: string;
  confidence: number;
}

export async function importDecisionRowsBatched(
  datasetId: string,
  jobId: string,
  rows: ParsedCsvRow[]
): Promise<BatchedImportResult> {
  const validationStarted = performance.now();
  const errorsByRow = new Map<number, IngestionRowError[]>();
  const normalized: NormalizedDecisionRow[] = [];

  for (const row of rows) {
    const parsed = decisionImportRowSchema.safeParse(row.values);
    if (!parsed.success) {
      errorsByRow.set(row.rowNumber, zodErrorsToRows(parsed.error, row.rowNumber, row.values));
      continue;
    }
    try {
      if (!parsed.data.decided_at) {
        throw new Error('decided_at is required.');
      }
      const normalizedConf = parsed.data.confidence ? normalizeConfidence(parsed.data.confidence) : null;
      const confidence = normalizedConf !== null ? parseFloat(normalizedConf) : null;
      normalized.push({
        row,
        value: parsed.data,
        decidedAt: normalizeIsoTimestamp(parsed.data.decided_at),
        confidence: confidence ?? 0,
      });
    } catch (error) {
      reject(errorsByRow, row, 'decided_at', 'INVALID_TIMESTAMP', error instanceof Error ? error.message : 'Invalid value.');
    }
  }

  const validationMs = elapsed(validationStarted);
  const persistenceStarted = performance.now();

  const active = () => normalized.filter((entry) => !errorsByRow.has(entry.row.rowNumber));
  const orderExternalIds = unique(active().map((e) => e.value.order_id));
  const supplierExternalIds = unique(active().map((e) => e.value.selected_supplier_id));

  const [ordersMap, suppliersMap] = await Promise.all([
    fetchMap('orders', 'external_order_id', orderExternalIds, datasetId),
    fetchMap('suppliers', 'external_supplier_id', supplierExternalIds, datasetId),
  ]);

  for (const entry of active()) {
    if (!ordersMap.has(entry.value.order_id)) {
      reject(errorsByRow, entry.row, 'order_id', 'CROSS_DATASET_REFERENCE', 'The order does not exist in this dataset.');
    }
    if (!suppliersMap.has(entry.value.selected_supplier_id)) {
      reject(errorsByRow, entry.row, 'selected_supplier_id', 'CROSS_DATASET_REFERENCE', 'The selected supplier does not exist.');
    }
  }

  const decisionInserts = active().map((entry): Inserts['ai_decisions']['Insert'] => ({
    dataset_id: datasetId,
    external_decision_id: entry.value.decision_id,
    order_id: ordersMap.get(entry.value.order_id)!.id,
    selected_supplier_id: suppliersMap.get(entry.value.selected_supplier_id)!.id,
    decided_at: entry.decidedAt,
    agent_name: entry.value.agent_name || 'cluster-resolve',
    agent_version: entry.value.agent_version || '1.0.0',
    confidence: entry.confidence,
    selection_reason: entry.value.selection_reason || null,
    source_ingestion_job_id: jobId,
  }));

  await upsertBatches('ai_decisions', decisionInserts, 'dataset_id,external_decision_id', {
    jobId,
    label: 'decisions',
  });

  const allErrors: IngestionRowError[] = [];
  for (const errs of errorsByRow.values()) allErrors.push(...errs);

  return {
    accepted: decisionInserts.length,
    errors: allErrors,
    validationMs,
    persistenceMs: elapsed(persistenceStarted),
  };
}

// ── 3. BATCHED OUTCOMES IMPORT ───────────────────────────────────────────────

interface NormalizedOutcomeRow {
  row: ParsedCsvRow;
  value: OutcomeImportRow;
  filledQty: number;
  deliveredAt: string | null;
  cancelled: boolean;
  final: boolean;
}

export async function importOutcomeRowsBatched(
  datasetId: string,
  jobId: string,
  rows: ParsedCsvRow[]
): Promise<BatchedImportResult> {
  const validationStarted = performance.now();
  const errorsByRow = new Map<number, IngestionRowError[]>();
  const normalized: NormalizedOutcomeRow[] = [];

  for (const row of rows) {
    const parsed = outcomeImportRowSchema.safeParse(row.values);
    if (!parsed.success) {
      errorsByRow.set(row.rowNumber, zodErrorsToRows(parsed.error, row.rowNumber, row.values));
      continue;
    }
    try {
      normalized.push({
        row,
        value: parsed.data,
        filledQty: parseNonNegativeInteger(parsed.data.filled_qty, 'filled_qty'),
        deliveredAt: parsed.data.delivered_at ? normalizeIsoTimestamp(parsed.data.delivered_at) : null,
        cancelled: parseStrictBoolean(parsed.data.cancelled),
        final: parsed.data.outcome_final !== undefined ? parseStrictBoolean(parsed.data.outcome_final) : true,
      });
    } catch (error) {
      reject(errorsByRow, row, 'filled_qty', 'INVALID_QUANTITY', error instanceof Error ? error.message : 'Invalid value.');
    }
  }

  const validationMs = elapsed(validationStarted);
  const persistenceStarted = performance.now();

  const active = () => normalized.filter((entry) => !errorsByRow.has(entry.row.rowNumber));
  const orderExternalIds = unique(active().map((e) => e.value.order_id));
  const productExternalIds = unique(active().map((e) => e.value.product_id));
  const supplierExternalIds = unique(active().map((e) => e.value.supplier_id));

  const [ordersMap, productsMap, suppliersMap] = await Promise.all([
    fetchMap('orders', 'external_order_id', orderExternalIds, datasetId),
    fetchMap('products', 'external_product_id', productExternalIds, datasetId),
    fetchMap('suppliers', 'external_supplier_id', supplierExternalIds, datasetId),
  ]);

  const [crossOrders, crossProducts, crossSuppliers] = await Promise.all([
    fetchOutsideDatasetIds('orders', 'external_order_id', orderExternalIds.filter((id) => !ordersMap.has(id)), datasetId),
    fetchOutsideDatasetIds('products', 'external_product_id', productExternalIds.filter((id) => !productsMap.has(id)), datasetId),
    fetchOutsideDatasetIds('suppliers', 'external_supplier_id', supplierExternalIds.filter((id) => !suppliersMap.has(id)), datasetId),
  ]);

  for (const entry of active()) {
    if (!ordersMap.has(entry.value.order_id)) {
      const cross = crossOrders.has(entry.value.order_id);
      reject(errorsByRow, entry.row, 'order_id', cross ? 'CROSS_DATASET_REFERENCE' : 'UNKNOWN_ORDER', cross ? 'The order exists in another dataset.' : 'The order does not exist.');
    }
    if (!productsMap.has(entry.value.product_id)) {
      const cross = crossProducts.has(entry.value.product_id);
      reject(errorsByRow, entry.row, 'product_id', cross ? 'CROSS_DATASET_REFERENCE' : 'UNKNOWN_PRODUCT', cross ? 'The product exists in another dataset.' : 'The product does not exist.');
    }
    if (!suppliersMap.has(entry.value.supplier_id)) {
      const cross = crossSuppliers.has(entry.value.supplier_id);
      reject(errorsByRow, entry.row, 'supplier_id', cross ? 'CROSS_DATASET_REFERENCE' : 'UNKNOWN_SUPPLIER', cross ? 'The supplier exists in another dataset.' : 'The supplier does not exist.');
    }
  }

  const outcomeInserts = active().map((entry): Inserts['order_outcomes']['Insert'] => ({
    dataset_id: datasetId,
    order_id: ordersMap.get(entry.value.order_id)!.id,
    product_id: productsMap.get(entry.value.product_id)!.id,
    supplier_id: suppliersMap.get(entry.value.supplier_id)!.id,
    filled_qty: entry.filledQty,
    delivered_at: entry.deliveredAt,
    cancelled: entry.cancelled,
    cancellation_reason: entry.value.cancellation_reason || null,
    outcome_final: entry.final,
    source_ingestion_job_id: jobId,
  }));

  await upsertBatches('order_outcomes', outcomeInserts, 'dataset_id,order_id,supplier_id,product_id', {
    jobId,
    label: 'outcomes',
  });

  const allErrors: IngestionRowError[] = [];
  for (const errs of errorsByRow.values()) allErrors.push(...errs);

  return {
    accepted: outcomeInserts.length,
    errors: allErrors,
    validationMs,
    persistenceMs: elapsed(persistenceStarted),
  };
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

export const QUERY_BATCH_SIZE = 500;
export const WRITE_BATCH_SIZE = 500;
export const MAX_BATCH_CONCURRENCY = 3;

async function fetchMap(
  table: 'orders' | 'products' | 'suppliers' | 'pharmacies',
  column: 'external_order_id' | 'external_product_id' | 'external_supplier_id' | 'external_pharmacy_id',
  ids: string[],
  datasetId: string
): Promise<Map<string, { id: string; [key: string]: unknown }>> {
  const supabase = getSupabaseServerClient();
  const output = new Map<string, { id: string; [key: string]: unknown }>();
  if (ids.length === 0) return output;

  const chunkList = chunks(ids, QUERY_BATCH_SIZE).filter((b) => b.length > 0);
  const results = await mapConcurrent(chunkList, MAX_BATCH_CONCURRENCY, async (batch, index) => {
    return withTransientRetry(async () => {
      const { data, error } = await supabase
        .from(table as never)
        .select('*')
        .eq('dataset_id', datasetId)
        .in(column as never, batch);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; [key: string]: unknown }>;
    }, `${table} reference batch ${index + 1}/${chunkList.length}`);
  });

  for (const rows of results) {
    for (const row of rows) {
      output.set(String(row[column]), row);
    }
  }
  return output;
}

async function upsertBatches<
  T extends 'suppliers' | 'supplier_offers' | 'ai_decisions' | 'order_outcomes'
>(
  table: T,
  values: Inserts[T]['Insert'][],
  onConflict: string,
  progress?: { jobId: string; label: string }
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const chunkList = chunks(values, WRITE_BATCH_SIZE).filter((b) => b.length > 0);
  let persisted = 0;
  let nextProgress = 5_000;
  let progressUpdates = Promise.resolve();
  await mapConcurrent(chunkList, MAX_BATCH_CONCURRENCY, async (batch, index) => {
    await withTransientRetry(async () => {
      const { error } = await supabase
        .from(table as never)
        .upsert(batch as never, { onConflict, ignoreDuplicates: true });
      if (error) throw error;
    }, `${table} write chunk ${index + 1}/${chunkList.length}`);
    persisted += batch.length;
    if (progress && (persisted >= nextProgress || persisted === values.length)) {
      const checkpoint = persisted;
      while (nextProgress <= persisted) nextProgress += 5_000;
      console.log(`[${progress.label}] ${checkpoint.toLocaleString('en-US')} / ${values.length.toLocaleString('en-US')} persisted`);
      progressUpdates = progressUpdates.then(() =>
        withTransientRetry(
          () => updateImportJobProgress(progress.jobId, { processed: checkpoint, valid: checkpoint, errors: 0 }),
          `${table} progress checkpoint`
        )
      );
    }
  });
  await progressUpdates;
}

export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  retries = 3,
  baseDelayMs = 1_000
): Promise<T> {
  let originalError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      originalError ??= err;
      if (!isTransientSupabaseError(err) || attempt === retries) throw originalError;
      const delayMs = baseDelayMs * (2 ** attempt);
      console.warn(`[imports] ${operation} transient failure; retry ${attempt + 1}/${retries} in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw originalError;
}

export function isTransientSupabaseError(error: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const value = current as { message?: unknown; code?: unknown; status?: unknown; cause?: unknown };
    parts.push(String(value.message ?? ''), String(value.code ?? ''), String(value.status ?? ''));
    current = value.cause;
  }
  const text = parts.join(' ').toUpperCase();
  return /FETCH FAILED|UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|EAI_AGAIN|\b50[0234]\b/.test(text);
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function chunks<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < values.length; i += size) output.push(values.slice(i, i + size));
  return output;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: T[], key: (value: T) => string): T[] {
  const found = new Map<string, T>();
  for (const value of values) if (!found.has(key(value))) found.set(key(value), value);
  return [...found.values()];
}

function markOfferInFileConflicts(
  rows: NormalizedOfferRow[],
  errors: Map<number, IngestionRowError[]>
): void {
  const signatures = new Map<string, string>();
  for (const entry of rows) {
    const signature = [
      entry.value.order_id,
      entry.value.supplier_id,
      normalizeName(entry.value.supplier_name),
      entry.value.product_id,
      entry.availableQty,
      entry.priceMinor.toString(),
      entry.discountBps,
      entry.promisedAt ?? '',
      entry.offeredAt,
    ].join('\u0000');
    const prior = signatures.get(entry.value.offer_id);
    if (prior !== undefined && prior !== signature) {
      reject(errors, entry.row, 'offer_id', 'DUPLICATE_EXTERNAL_ID', 'The offer ID is reused with conflicting offer data.');
    } else {
      signatures.set(entry.value.offer_id, signature);
    }
  }
}

async function fetchOutsideDatasetIds(
  table: 'orders' | 'products' | 'suppliers',
  column: 'external_order_id' | 'external_product_id' | 'external_supplier_id',
  ids: string[],
  datasetId: string
): Promise<Set<string>> {
  const supabase = getSupabaseServerClient();
  const found = new Set<string>();
  const chunkList = chunks(ids, QUERY_BATCH_SIZE).filter((batch) => batch.length > 0);
  const results = await mapConcurrent(chunkList, MAX_BATCH_CONCURRENCY, (batch, index) =>
    withTransientRetry(async () => {
      const { data, error } = await supabase
        .from(table as never)
        .select(column)
        .neq('dataset_id', datasetId)
        .in(column as never, batch);
      if (error) throw error;
      return (data ?? []) as Array<Record<string, unknown>>;
    }, `${table} cross-dataset reference batch ${index + 1}/${chunkList.length}`)
  );
  for (const rows of results) for (const row of rows) found.add(String(row[column]));
  return found;
}

function reject(
  errors: Map<number, IngestionRowError[]>,
  row: ParsedCsvRow,
  field: string,
  code: IngestionRowError['code'],
  message: string
): void {
  if (errors.has(row.rowNumber)) return;
  errors.set(row.rowNumber, [
    {
      rowNumber: row.rowNumber,
      field,
      code,
      message,
      rawValue: row.values[field] ?? null,
    },
  ]);
}

function priceFailed(input: string): boolean {
  try {
    toPiastres(input);
    return false;
  } catch {
    return true;
  }
}

function elapsed(started: number): number {
  return Math.round((performance.now() - started) * 100) / 100;
}
