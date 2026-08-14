import { normalizeIsoTimestamp, parsePositiveInteger } from '@cluster/core/ingestion/values';
import { normalizeName } from '@cluster/core/util/normalize';
import { orderImportRowSchema, type OrderImportRow } from '@cluster/schemas/imports';
import type { Database } from '../db/generated-types';
import { getSupabaseServerClient } from '../supabase/server';
import type { ParsedCsvRow } from './csv';
import { type IngestionRowError, zodErrorsToRows } from './errors';

type Inserts = Database['public']['Tables'];

interface NormalizedOrderRow {
  row: ParsedCsvRow;
  value: OrderImportRow;
  placedAt: string;
  requestedQty: number;
  unit: string;
}

export interface BatchedOrderImportResult {
  accepted: number;
  errors: IngestionRowError[];
  validationMs: number;
  persistenceMs: number;
}

// Keep UUID `.in(...)` filters comfortably below the Data API/Undici header limit.
const QUERY_BATCH_SIZE = 150;
const WRITE_BATCH_SIZE = 400;

export async function importOrderRowsBatched(
  datasetId: string,
  jobId: string,
  rows: ParsedCsvRow[]
): Promise<BatchedOrderImportResult> {
  const validationStarted = performance.now();
  const errorsByRow = new Map<number, IngestionRowError[]>();
  const normalized: NormalizedOrderRow[] = [];

  for (const row of rows) {
    const parsed = orderImportRowSchema.safeParse(row.values);
    if (!parsed.success) {
      errorsByRow.set(row.rowNumber, zodErrorsToRows(parsed.error, row.rowNumber, row.values));
      continue;
    }
    try {
      normalized.push({
        row,
        value: parsed.data,
        placedAt: normalizeIsoTimestamp(parsed.data.placed_at),
        requestedQty: parsePositiveInteger(parsed.data.requested_qty, 'requested_qty'),
        unit: parsed.data.unit ? parsed.data.unit.toLowerCase() : 'pack',
      });
    } catch (error) {
      const field = timestampFailed(parsed.data.placed_at) ? 'placed_at' : 'requested_qty';
      reject(
        errorsByRow,
        row,
        field,
        field === 'placed_at' ? 'INVALID_TIMESTAMP' : 'INVALID_QUANTITY',
        error instanceof Error ? error.message : 'The value is invalid.'
      );
    }
  }

  markInFileConflicts(normalized, errorsByRow);
  const validationMs = elapsed(validationStarted);
  const persistenceStarted = performance.now();
  const supabase = getSupabaseServerClient();

  const active = () => normalized.filter((entry) => !errorsByRow.has(entry.row.rowNumber));
  const pharmacyIds = unique(active().map((entry) => entry.value.pharmacy_id));
  const productIds = unique(active().map((entry) => entry.value.product_id));

  let pharmacies = indexBy(
    await fetchInBatches(pharmacyIds, async (ids) => {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('dataset_id', datasetId)
        .in('external_pharmacy_id', ids);
      if (error) throw error;
      return data;
    }),
    'external_pharmacy_id'
  );
  let products = indexBy(
    await fetchInBatches(productIds, async (ids) => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('dataset_id', datasetId)
        .in('external_product_id', ids);
      if (error) throw error;
      return data;
    }),
    'external_product_id'
  );

  const missingPharmacyIds = pharmacyIds.filter((id) => !pharmacies.has(id));
  const missingProductIds = productIds.filter((id) => !products.has(id));
  const crossPharmacies = await fetchCrossDatasetIds(
    'pharmacies',
    'external_pharmacy_id',
    missingPharmacyIds,
    datasetId
  );
  const crossProducts = await fetchCrossDatasetIds(
    'products',
    'external_product_id',
    missingProductIds,
    datasetId
  );

  for (const entry of active()) {
    if (crossPharmacies.has(entry.value.pharmacy_id)) {
      reject(errorsByRow, entry.row, 'pharmacy_id', 'CROSS_DATASET_REFERENCE', 'The pharmacy exists in another dataset.');
    } else if (!pharmacies.has(entry.value.pharmacy_id) && !entry.value.pharmacy_name) {
      reject(errorsByRow, entry.row, 'pharmacy_name', 'MISSING_REQUIRED_FIELD', 'A new pharmacy requires pharmacy_name.');
    }
    if (crossProducts.has(entry.value.product_id)) {
      reject(errorsByRow, entry.row, 'product_id', 'CROSS_DATASET_REFERENCE', 'The product exists in another dataset.');
    }
  }

  const pharmacyInserts = uniqueBy(
    active()
      .filter((entry) => !pharmacies.has(entry.value.pharmacy_id))
      .map((entry): Inserts['pharmacies']['Insert'] => ({
        dataset_id: datasetId,
        external_pharmacy_id: entry.value.pharmacy_id,
        name: entry.value.pharmacy_name,
        source_ingestion_job_id: jobId,
      })),
    (entry) => entry.external_pharmacy_id
  );
  await upsertBatches('pharmacies', pharmacyInserts, 'dataset_id,external_pharmacy_id');

  const productInserts = uniqueBy(
    active()
      .filter((entry) => !products.has(entry.value.product_id))
      .map((entry): Inserts['products']['Insert'] => ({
        dataset_id: datasetId,
        external_product_id: entry.value.product_id,
        name: entry.value.product_name,
        name_normalized: normalizeName(entry.value.product_name),
        manufacturer: entry.value.manufacturer || null,
        manufacturer_normalized: entry.value.manufacturer
          ? normalizeName(entry.value.manufacturer)
          : null,
        source_ingestion_job_id: jobId,
      })),
    (entry) => entry.external_product_id
  );
  await upsertBatches('products', productInserts, 'dataset_id,external_product_id');

  pharmacies = indexBy(
    await fetchInBatches(pharmacyIds, async (ids) => {
      const { data, error } = await supabase.from('pharmacies').select('*').eq('dataset_id', datasetId).in('external_pharmacy_id', ids);
      if (error) throw error;
      return data;
    }),
    'external_pharmacy_id'
  );
  products = indexBy(
    await fetchInBatches(productIds, async (ids) => {
      const { data, error } = await supabase.from('products').select('*').eq('dataset_id', datasetId).in('external_product_id', ids);
      if (error) throw error;
      return data;
    }),
    'external_product_id'
  );

  for (const entry of active()) {
    const pharmacy = pharmacies.get(entry.value.pharmacy_id);
    const product = products.get(entry.value.product_id);
    if (!pharmacy || !product) throw new Error('Canonical reference creation did not persist.');
    if (
      entry.value.pharmacy_name &&
      pharmacy.name &&
      normalizeName(pharmacy.name) !== normalizeName(entry.value.pharmacy_name)
    ) {
      reject(errorsByRow, entry.row, 'pharmacy_name', 'CONFLICTING_RECORD', 'The pharmacy name conflicts with existing canonical data.');
    } else if (
      normalizeName(product.name) !== normalizeName(entry.value.product_name) ||
      (entry.value.manufacturer &&
        product.manufacturer &&
        normalizeName(product.manufacturer) !== normalizeName(entry.value.manufacturer))
    ) {
      reject(errorsByRow, entry.row, 'product_name', 'CONFLICTING_RECORD', 'Product metadata conflicts with existing canonical data.');
    }
  }

  const orderExternalIds = unique(active().map((entry) => entry.value.order_id));
  let orders = indexBy(
    await fetchInBatches(orderExternalIds, async (ids) => {
      const { data, error } = await supabase.from('orders').select('*').eq('dataset_id', datasetId).in('external_order_id', ids);
      if (error) throw error;
      return data;
    }),
    'external_order_id'
  );
  const missingOrderIds = orderExternalIds.filter((id) => !orders.has(id));
  const crossOrders = await fetchCrossDatasetIds('orders', 'external_order_id', missingOrderIds, datasetId);
  for (const entry of active()) {
    if (crossOrders.has(entry.value.order_id)) {
      reject(errorsByRow, entry.row, 'order_id', 'CROSS_DATASET_REFERENCE', 'The order exists in another dataset.');
    }
  }

  const orderInserts = uniqueBy(
    active()
      .filter((entry) => !orders.has(entry.value.order_id))
      .map((entry): Inserts['orders']['Insert'] => ({
        dataset_id: datasetId,
        external_order_id: entry.value.order_id,
        pharmacy_id: requireMap(pharmacies, entry.value.pharmacy_id).id,
        status: 'IMPORTED',
        placed_at: entry.placedAt,
        source_ingestion_job_id: jobId,
      })),
    (entry) => entry.external_order_id
  );
  await upsertBatches('orders', orderInserts, 'dataset_id,external_order_id');
  orders = indexBy(
    await fetchInBatches(orderExternalIds, async (ids) => {
      const { data, error } = await supabase.from('orders').select('*').eq('dataset_id', datasetId).in('external_order_id', ids);
      if (error) throw error;
      return data;
    }),
    'external_order_id'
  );

  for (const entry of active()) {
    const order = requireMap(orders, entry.value.order_id);
    const pharmacy = requireMap(pharmacies, entry.value.pharmacy_id);
    if (order.pharmacy_id !== pharmacy.id || !timestampsEqual(order.placed_at, entry.placedAt)) {
      reject(errorsByRow, entry.row, 'order_id', 'CONFLICTING_RECORD', 'Order metadata conflicts with existing canonical data.');
    }
  }

  const orderIds = unique(active().map((entry) => requireMap(orders, entry.value.order_id).id));
  const existingItems = await fetchInBatches(orderIds, async (ids) => {
    const { data, error } = await supabase.from('order_items').select('*').eq('dataset_id', datasetId).in('order_id', ids);
    if (error) throw error;
    return data;
  });
  const items = new Map(existingItems.map((item) => [itemKey(item.order_id, item.product_id), item]));

  for (const entry of active()) {
    const order = requireMap(orders, entry.value.order_id);
    const product = requireMap(products, entry.value.product_id);
    const item = items.get(itemKey(order.id, product.id));
    if (item && (item.requested_qty !== entry.requestedQty || item.unit !== entry.unit)) {
      reject(errorsByRow, entry.row, 'product_id', 'CONFLICTING_RECORD', 'Order item data conflicts with the existing order item.');
    }
  }

  const itemInserts = uniqueBy(
    active()
      .filter((entry) => {
        const order = requireMap(orders, entry.value.order_id);
        const product = requireMap(products, entry.value.product_id);
        return !items.has(itemKey(order.id, product.id));
      })
      .map((entry): Inserts['order_items']['Insert'] => ({
        dataset_id: datasetId,
        order_id: requireMap(orders, entry.value.order_id).id,
        product_id: requireMap(products, entry.value.product_id).id,
        requested_qty: entry.requestedQty,
        unit: entry.unit,
        source_ingestion_job_id: jobId,
      })),
    (entry) => itemKey(entry.order_id, entry.product_id)
  );
  await upsertBatches('order_items', itemInserts, 'order_id,product_id');

  return {
    accepted: active().length,
    errors: [...errorsByRow.values()].flat().sort((left, right) => left.rowNumber - right.rowNumber),
    validationMs,
    persistenceMs: elapsed(persistenceStarted),
  };
}

function markInFileConflicts(
  rows: NormalizedOrderRow[],
  errors: Map<number, IngestionRowError[]>
): void {
  const pharmacies = new Map<string, string>();
  const products = new Map<string, string>();
  const orders = new Map<string, string>();
  const items = new Map<string, string>();
  for (const entry of rows) {
    const pharmacyName = entry.value.pharmacy_name
      ? normalizeName(entry.value.pharmacy_name)
      : '';
    const priorPharmacy = pharmacies.get(entry.value.pharmacy_id);
    if (priorPharmacy && pharmacyName && priorPharmacy !== pharmacyName) {
      reject(errors, entry.row, 'pharmacy_name', 'CONFLICTING_RECORD', 'The pharmacy has conflicting metadata within this file.');
      continue;
    }
    if (pharmacyName) pharmacies.set(entry.value.pharmacy_id, pharmacyName);

    const productSignature = `${normalizeName(entry.value.product_name)}\u0000${entry.value.manufacturer ? normalizeName(entry.value.manufacturer) : ''}`;
    const priorProduct = products.get(entry.value.product_id);
    if (priorProduct && priorProduct !== productSignature) {
      reject(errors, entry.row, 'product_name', 'CONFLICTING_RECORD', 'The product has conflicting metadata within this file.');
      continue;
    }
    products.set(entry.value.product_id, productSignature);

    const orderSignature = `${entry.value.pharmacy_id}\u0000${entry.placedAt}`;
    const priorOrder = orders.get(entry.value.order_id);
    if (priorOrder && priorOrder !== orderSignature) {
      reject(errors, entry.row, 'order_id', 'CONFLICTING_RECORD', 'The order has conflicting metadata within this file.');
      continue;
    }
    orders.set(entry.value.order_id, orderSignature);

    const key = `${entry.value.order_id}\u0000${entry.value.product_id}`;
    const signature = `${entry.requestedQty}\u0000${entry.unit}`;
    const priorItem = items.get(key);
    if (priorItem && priorItem !== signature) {
      reject(errors, entry.row, 'product_id', 'CONFLICTING_RECORD', 'The order item has conflicting data within this file.');
      continue;
    }
    items.set(key, signature);
  }
}

async function fetchCrossDatasetIds(
  table: 'pharmacies' | 'products' | 'orders',
  column: 'external_pharmacy_id' | 'external_product_id' | 'external_order_id',
  ids: string[],
  datasetId: string
): Promise<Set<string>> {
  const supabase = getSupabaseServerClient();
  const found = await fetchInBatches(ids, async (batch) => {
    if (table === 'pharmacies') {
      const { data, error } = await supabase.from(table).select('external_pharmacy_id').neq('dataset_id', datasetId).in('external_pharmacy_id', batch);
      if (error) throw error;
      return data.map((row) => row.external_pharmacy_id);
    }
    if (table === 'products') {
      const { data, error } = await supabase.from(table).select('external_product_id').neq('dataset_id', datasetId).in('external_product_id', batch);
      if (error) throw error;
      return data.map((row) => row.external_product_id);
    }
    const { data, error } = await supabase.from(table).select('external_order_id').neq('dataset_id', datasetId).in('external_order_id', batch);
    if (error) throw error;
    return data.map((row) => row.external_order_id);
  });
  return new Set(found);
}

async function upsertBatches<T extends 'pharmacies' | 'products' | 'orders' | 'order_items'>(
  table: T,
  values: Inserts[T]['Insert'][],
  onConflict: string
): Promise<void> {
  const supabase = getSupabaseServerClient();
  for (const batch of chunks(values, WRITE_BATCH_SIZE)) {
    if (batch.length === 0) continue;
    const { error } = await supabase
      .from(table)
      .upsert(batch as never, { onConflict, ignoreDuplicates: true });
    if (error) throw error;
  }
}

async function fetchInBatches<T>(
  values: string[],
  load: (batch: string[]) => Promise<T[]>
): Promise<T[]> {
  const output: T[] = [];
  for (const batch of chunks(values, QUERY_BATCH_SIZE)) output.push(...await load(batch));
  return output;
}

function chunks<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
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

function indexBy<T, K extends keyof T>(values: T[], key: K): Map<string, T> {
  return new Map(values.map((value) => [String(value[key]), value]));
}

function requireMap<T>(values: Map<string, T>, key: string): T {
  const value = values.get(key);
  if (!value) throw new Error(`Canonical reference ${key} was not resolved.`);
  return value;
}

function itemKey(orderId: string, productId: string): string {
  return `${orderId}\u0000${productId}`;
}

function reject(
  errors: Map<number, IngestionRowError[]>,
  row: ParsedCsvRow,
  field: string,
  code: IngestionRowError['code'],
  message: string
): void {
  if (errors.has(row.rowNumber)) return;
  errors.set(row.rowNumber, [{
    rowNumber: row.rowNumber,
    field,
    code,
    message,
    rawValue: row.values[field] ?? null,
  }]);
}

function timestampFailed(input: string): boolean {
  try {
    normalizeIsoTimestamp(input);
    return false;
  } catch {
    return true;
  }
}

function timestampsEqual(left: string, right: string): boolean {
  return normalizeIsoTimestamp(left) === normalizeIsoTimestamp(right);
}

function elapsed(started: number): number {
  return Math.round((performance.now() - started) * 100) / 100;
}
