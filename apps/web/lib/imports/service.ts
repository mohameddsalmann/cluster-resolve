import {
  decisionImportRowSchema,
  importKindSchema,
  offerImportRowSchema,
  orderImportRowSchema,
  outcomeImportRowSchema,
  type ImportKind,
} from '@cluster/schemas/imports';
import {
  discountPercentToBps,
  normalizeConfidence,
  normalizeIsoTimestamp,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parseStrictBoolean,
} from '@cluster/core/ingestion/values';
import { normalizeName } from '@cluster/core/util/normalize';
import { toPiastres } from '@cluster/core/util/money';
import { getDatasetById } from '../db/repositories/datasets';
import {
  getOrCreateCsvImportSource,
  markImportSourceIngested,
} from '../db/repositories/data-sources';
import {
  completeImportJob,
  createImportJob,
  deleteImportJob,
  failImportJob,
  findActiveIdenticalImport,
  getImportJob,
  identifyImportJob,
  setImportJobStoragePath,
  startImportJob,
} from '../db/repositories/ingestion-jobs';
import { replaceIngestionErrors } from '../db/repositories/ingestion-errors';
import { createPharmacy, getPharmacyByExternalId } from '../db/repositories/pharmacies';
import { createProduct, getProductByExternalId } from '../db/repositories/products';
import { createSupplier, getSupplierByExternalId } from '../db/repositories/suppliers';
import {
  createOrder,
  createOrderItem,
  getOrderByExternalId,
  getOrderItem,
} from '../db/repositories/orders';
import { createSupplierOffer, getSupplierOfferByExternalId } from '../db/repositories/offers';
import {
  advanceOrderOutcome,
  createOrderOutcome,
  getOrderOutcomeByReferences,
} from '../db/repositories/outcomes';
import { createAiDecision, getAiDecisionByExternalId } from '../db/repositories/decisions';
import { getSupabaseServerClient } from '../supabase/server';
import type {
  AiDecisionRow,
  OrderRow,
  PharmacyRow,
  ProductRow,
  SupplierRow,
} from '../db/row-types';
import { decodeUtf8, parseMappedCsv, type ParsedCsvRow } from './csv';
import {
  ImportJobError,
  jobErrorResponse,
  safeDatabaseError,
  type IngestionRowError,
  type RowErrorCode,
  zodErrorsToRows,
} from './errors';
import { sha256Hex } from './hash';
import {
  MAX_IMPORT_BYTES,
  createSignedImportUpload,
  downloadImport,
  importStoragePath,
  removeImport,
  sanitizeFilename,
} from './storage';
import { importOrderRowsBatched } from './orders-batch';
import {
  importDecisionRowsBatched,
  importOfferRowsBatched,
  importOutcomeRowsBatched,
} from './batch-importers';

export interface InitializeImportInput {
  datasetId: string;
  kind: string;
  filename: string;
  size: number;
  contentType?: string | null;
}

export interface InitializeImportResult {
  jobId: string;
  storagePath: string;
  signedUrl: string;
  token: string;
  expiresInSeconds: number;
}

export type ImportResultState =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'ALREADY_IMPORTED'
  | 'IN_PROGRESS'
  | 'FAILED';

export interface ProcessImportResult {
  jobId: string;
  state: ImportResultState;
  originalJobId?: string;
  processedRows: number;
  acceptedRows: number;
  rejectedRows: number;
  error?: { code: string; message: string };
  timingsMs?: {
    storageDownload: number;
    hash: number;
    parse: number;
    validation: number;
    persistence: number;
    total: number;
  };
}

interface RowContext {
  datasetId: string;
  jobId: string;
  row: ParsedCsvRow;
}

interface ReferenceCaches {
  pharmacies: Map<string, PharmacyRow | null>;
  products: Map<string, ProductRow | null>;
  suppliers: Map<string, SupplierRow | null>;
  orders: Map<string, OrderRow | null>;
  globalReferences: Map<string, boolean>;
}

const CSV_CONTENT_TYPES = new Set([
  '',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
]);

export async function initializeImport(
  input: InitializeImportInput
): Promise<InitializeImportResult> {
  const kind = importKindSchema.safeParse(input.kind);
  if (!kind.success) {
    throw new ImportJobError('UNSUPPORTED_IMPORT_TYPE', 'Choose a supported canonical import type.');
  }
  const filename = sanitizeFilename(input.filename);
  if (!filename.toLowerCase().endsWith('.csv')) {
    throw new ImportJobError('UNSUPPORTED_IMPORT_TYPE', 'Phase 3 accepts canonical CSV files only.');
  }
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_IMPORT_BYTES) {
    throw new ImportJobError('FILE_TOO_LARGE', 'CSV files must be non-empty and no larger than 10 MiB.');
  }
  const contentType = (input.contentType ?? '').toLowerCase();
  if (!CSV_CONTENT_TYPES.has(contentType)) {
    throw new ImportJobError('UNSUPPORTED_IMPORT_TYPE', 'The selected file must be a CSV file.');
  }
  if (!(await getDatasetById(input.datasetId))) {
    throw new ImportJobError('IMPORT_FAILED', 'The selected dataset does not exist.');
  }

  const source = await getOrCreateCsvImportSource(input.datasetId);
  const job = await createImportJob({
    datasetId: input.datasetId,
    sourceId: source.id,
    kind: kind.data,
    filename,
  });
  const storagePath = importStoragePath(input.datasetId, job.id, filename);

  try {
    await setImportJobStoragePath(job.id, storagePath);
    const signed = await createSignedImportUpload(storagePath);
    return {
      jobId: job.id,
      storagePath,
      signedUrl: signed.signedUrl,
      token: signed.token,
      expiresInSeconds: 7_200,
    };
  } catch (error) {
    const safe = jobErrorResponse(error);
    try {
      await failImportJob(job.id, safe.code, safe.message);
    } catch (recordingError) {
      console.error('[imports] Could not record initialization failure:', recordingError);
    }
    throw error;
  }
}

export async function processStoredImport(
  jobId: string,
  mapping?: Record<string, string | null> | null
): Promise<ProcessImportResult> {
  const totalStarted = performance.now();
  const job = await getImportJob(jobId);
  if (!job) throw new ImportJobError('IMPORT_FAILED', 'The ingestion job does not exist.');

  if (job.status === 'COMPLETED') {
    return resultFromCompletedJob(job);
  }
  if (job.status === 'PROCESSING') {
    return {
      jobId: job.id,
      state: 'IN_PROGRESS',
      processedRows: job.processed_rows,
      acceptedRows: job.valid_rows,
      rejectedRows: job.error_rows,
    };
  }
  if (!job.storage_path) {
    throw new ImportJobError('STORAGE_FAILED', 'The ingestion job has no stored CSV path.');
  }

  try {
    const downloadStarted = performance.now();
    const bytes = await downloadImport(job.storage_path);
    const storageDownload = elapsed(downloadStarted);
    const hashStarted = performance.now();
    const hash = sha256Hex(bytes);
    const hashDuration = elapsed(hashStarted);
    await identifyImportJob(job.id, hash);

    const duplicate = await findActiveIdenticalImport(job.dataset_id, job.kind, hash, job.id);
    if (duplicate) {
      await removeImport(job.storage_path);
      await deleteImportJob(job.id);
      return duplicateResult(duplicate);
    }

    const parseStarted = performance.now();
    const rows = parseMappedCsv(
      decodeUtf8(bytes),
      importKindSchema.parse(job.kind),
      mapping
    );
    const parseDuration = elapsed(parseStarted);
    try {
      await startImportJob(job.id, hash, rows.length);
    } catch (error) {
      const racedDuplicate = await findActiveIdenticalImport(job.dataset_id, job.kind, hash, job.id);
      if (!racedDuplicate) throw error;
      await removeImport(job.storage_path);
      await deleteImportJob(job.id);
      return duplicateResult(racedDuplicate);
    }

    const outcome = await importRows(job.dataset_id, job.id, job.kind as ImportKind, rows);
    const errorPersistenceStarted = performance.now();
    await replaceIngestionErrors(job.id, outcome.errors);
    const persistence = outcome.persistenceMs + elapsed(errorPersistenceStarted);
    const rejectedRows = new Set(outcome.errors.map((error) => error.rowNumber)).size;

    if (outcome.accepted === 0) {
      const message = 'The file did not contain any valid rows.';
      await failImportJob(job.id, 'NO_VALID_ROWS', message, {
        processed: rows.length,
        valid: 0,
        errors: rejectedRows,
      });
      return {
        jobId: job.id,
        state: 'FAILED',
        processedRows: rows.length,
        acceptedRows: 0,
        rejectedRows,
        error: { code: 'NO_VALID_ROWS', message },
        timingsMs: {
          storageDownload,
          hash: hashDuration,
          parse: parseDuration,
          validation: outcome.validationMs,
          persistence,
          total: elapsed(totalStarted),
        },
      };
    }

    const finishedAt = await completeImportJob(job.id, {
      processed: rows.length,
      valid: outcome.accepted,
      errors: rejectedRows,
    });
    if (job.source_id) await markImportSourceIngested(job.source_id, finishedAt);

    return {
      jobId: job.id,
      state: outcome.errors.length === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS',
      processedRows: rows.length,
      acceptedRows: outcome.accepted,
      rejectedRows,
      timingsMs: {
        storageDownload,
        hash: hashDuration,
        parse: parseDuration,
        validation: outcome.validationMs,
        persistence,
        total: elapsed(totalStarted),
      },
    };
  } catch (error) {
    const safe = jobErrorResponse(error);
    console.error('[imports] Processing failed:', error);
    try {
      await failImportJob(job.id, safe.code, safe.message);
    } catch (recordingError) {
      console.error('[imports] Could not record failure; original processing error is preserved:', recordingError);
    }
    return {
      jobId: job.id,
      state: 'FAILED',
      processedRows: job.processed_rows,
      acceptedRows: job.valid_rows,
      rejectedRows: job.error_rows,
      error: safe,
    };
  }
}

function resultFromCompletedJob(job: Awaited<ReturnType<typeof getImportJob>> & {}): ProcessImportResult {
  return {
    jobId: job.id,
    state: job.error_rows > 0 ? 'PARTIAL_SUCCESS' : 'SUCCESS',
    processedRows: job.processed_rows,
    acceptedRows: job.valid_rows,
    rejectedRows: job.error_rows,
  };
}

function duplicateResult(job: NonNullable<Awaited<ReturnType<typeof getImportJob>>>): ProcessImportResult {
  return {
    jobId: job.id,
    originalJobId: job.id,
    state: job.status === 'COMPLETED' ? 'ALREADY_IMPORTED' : 'IN_PROGRESS',
    processedRows: job.processed_rows,
    acceptedRows: job.valid_rows,
    rejectedRows: job.error_rows,
  };
}

async function importRows(
  datasetId: string,
  jobId: string,
  kind: ImportKind,
  rows: ParsedCsvRow[]
): Promise<{
  accepted: number;
  errors: IngestionRowError[];
  validationMs: number;
  persistenceMs: number;
}> {
  if (kind === 'ORDERS') return importOrderRowsBatched(datasetId, jobId, rows);
  if (kind === 'OFFERS') return importOfferRowsBatched(datasetId, jobId, rows);
  if (kind === 'DECISIONS') return importDecisionRowsBatched(datasetId, jobId, rows);
  if (kind === 'OUTCOMES') return importOutcomeRowsBatched(datasetId, jobId, rows);

  const persistenceStarted = performance.now();
  const caches: ReferenceCaches = {
    pharmacies: new Map(),
    products: new Map(),
    suppliers: new Map(),
    orders: new Map(),
    globalReferences: new Map(),
  };
  const errors: IngestionRowError[] = [];
  let accepted = 0;

  for (const row of rows) {
    const context = { datasetId, jobId, row };
    const result = await importOneRow(kind, context, caches);
    if (result === true) accepted += 1;
    else errors.push(...result);
  }
  return { accepted, errors, validationMs: 0, persistenceMs: elapsed(persistenceStarted) };
}

async function importOneRow(
  kind: ImportKind,
  context: RowContext,
  caches: ReferenceCaches
): Promise<true | IngestionRowError[]> {
  try {
    if (kind === 'ORDERS') return await importOrderRow(context, caches);
    if (kind === 'OFFERS') return await importOfferRow(context, caches);
    if (kind === 'OUTCOMES') return await importOutcomeRow(context, caches);
    return await importDecisionRow(context, caches);
  } catch (error) {
    const safe = safeDatabaseError(error);
    return [rowError(context.row, null, safe.code, safe.message)];
  }
}

async function importOrderRow(
  context: RowContext,
  caches: ReferenceCaches
): Promise<true | IngestionRowError[]> {
  const parsed = orderImportRowSchema.safeParse(context.row.values);
  if (!parsed.success) return zodErrorsToRows(parsed.error, context.row.rowNumber, context.row.values);
  const value = parsed.data;

  let placedAt: string;
  let requestedQty: number;
  try {
    placedAt = normalizeIsoTimestamp(value.placed_at);
  } catch (error) {
    return [rowError(context.row, 'placed_at', 'INVALID_TIMESTAMP', errorMessage(error))];
  }
  try {
    requestedQty = parsePositiveInteger(value.requested_qty, 'requested_qty');
  } catch (error) {
    return [rowError(context.row, 'requested_qty', 'INVALID_QUANTITY', errorMessage(error))];
  }

  let pharmacy = await cachedPharmacy(context.datasetId, value.pharmacy_id, caches);
  if (!pharmacy) {
    if (await existsOutsideDataset('pharmacy', context.datasetId, value.pharmacy_id, caches)) {
      return [rowError(context.row, 'pharmacy_id', 'CROSS_DATASET_REFERENCE', 'The pharmacy exists in another dataset.')];
    }
    if (!value.pharmacy_name) {
      return [rowError(context.row, 'pharmacy_name', 'MISSING_REQUIRED_FIELD', 'A new pharmacy requires pharmacy_name.')];
    }
    pharmacy = await createPharmacy({
      dataset_id: context.datasetId,
      external_pharmacy_id: value.pharmacy_id,
      name: value.pharmacy_name,
      source_ingestion_job_id: context.jobId,
    });
    caches.pharmacies.set(value.pharmacy_id, pharmacy);
  } else if (value.pharmacy_name && pharmacy.name && normalizeName(pharmacy.name) !== normalizeName(value.pharmacy_name)) {
    return [rowError(context.row, 'pharmacy_name', 'CONFLICTING_RECORD', 'The pharmacy name conflicts with existing canonical data.')];
  }

  let product = await cachedProduct(context.datasetId, value.product_id, caches);
  if (!product) {
    if (await existsOutsideDataset('product', context.datasetId, value.product_id, caches)) {
      return [rowError(context.row, 'product_id', 'CROSS_DATASET_REFERENCE', 'The product exists in another dataset.')];
    }
    product = await createProduct({
      dataset_id: context.datasetId,
      external_product_id: value.product_id,
      name: value.product_name,
      manufacturer: value.manufacturer || null,
      source_ingestion_job_id: context.jobId,
    });
    caches.products.set(value.product_id, product);
  } else if (
    normalizeName(product.name) !== normalizeName(value.product_name) ||
    (value.manufacturer && product.manufacturer && normalizeName(product.manufacturer) !== normalizeName(value.manufacturer))
  ) {
    return [rowError(context.row, 'product_name', 'CONFLICTING_RECORD', 'Product metadata conflicts with existing canonical data.')];
  }

  let order = await cachedOrder(context.datasetId, value.order_id, caches);
  if (!order) {
    if (await existsOutsideDataset('order', context.datasetId, value.order_id, caches)) {
      return [rowError(context.row, 'order_id', 'CROSS_DATASET_REFERENCE', 'The order exists in another dataset.')];
    }
    order = await createOrder({
      dataset_id: context.datasetId,
      external_order_id: value.order_id,
      pharmacy_id: pharmacy.id,
      status: 'IMPORTED',
      placed_at: placedAt,
      source_ingestion_job_id: context.jobId,
    });
    caches.orders.set(value.order_id, order);
  } else if (order.pharmacy_id !== pharmacy.id || !timestampsEqual(order.placed_at, placedAt)) {
    return [rowError(context.row, 'order_id', 'CONFLICTING_RECORD', 'Order metadata conflicts with existing canonical data.')];
  }

  const unit = value.unit ? value.unit.toLowerCase() : 'pack';
  const item = await getOrderItem(context.datasetId, order.id, product.id);
  if (!item) {
    await createOrderItem({
      dataset_id: context.datasetId,
      order_id: order.id,
      product_id: product.id,
      requested_qty: requestedQty,
      unit,
      source_ingestion_job_id: context.jobId,
    });
  } else if (item.requested_qty !== requestedQty || item.unit !== unit) {
    return [rowError(context.row, 'product_id', 'CONFLICTING_RECORD', 'Order item data conflicts with the existing order item.')];
  }
  return true;
}

async function importOfferRow(
  context: RowContext,
  caches: ReferenceCaches
): Promise<true | IngestionRowError[]> {
  const parsed = offerImportRowSchema.safeParse(context.row.values);
  if (!parsed.success) return zodErrorsToRows(parsed.error, context.row.rowNumber, context.row.values);
  const value = parsed.data;

  const order = await requireOrderReference(context, value.order_id, caches);
  if (!order.ok) return [order.error];
  const product = await requireProductReference(context, value.product_id, caches);
  if (!product.ok) return [product.error];

  let supplier = await cachedSupplier(context.datasetId, value.supplier_id, caches);
  if (!supplier) {
    if (await existsOutsideDataset('supplier', context.datasetId, value.supplier_id, caches)) {
      return [rowError(context.row, 'supplier_id', 'CROSS_DATASET_REFERENCE', 'The supplier exists in another dataset.')];
    }
    supplier = await createSupplier({
      dataset_id: context.datasetId,
      external_supplier_id: value.supplier_id,
      name: value.supplier_name,
      source_ingestion_job_id: context.jobId,
    });
    caches.suppliers.set(value.supplier_id, supplier);
  } else if (normalizeName(supplier.name) !== normalizeName(value.supplier_name)) {
    return [rowError(context.row, 'supplier_name', 'CONFLICTING_RECORD', 'Supplier metadata conflicts with existing canonical data.')];
  }

  let availableQty: number;
  let price: bigint;
  let discountBps: number;
  let offeredAt: string;
  let promisedAt: string | null;
  try {
    availableQty = parseNonNegativeInteger(value.available_qty, 'available_qty');
  } catch (error) {
    return [rowError(context.row, 'available_qty', 'INVALID_QUANTITY', errorMessage(error))];
  }
  try {
    price = toPiastres(value.unit_price_egp);
    if (price > 9_223_372_036_854_775_807n) {
      throw new Error('Money exceeds the PostgreSQL BIGINT range.');
    }
  } catch (error) {
    return [rowError(context.row, 'unit_price_egp', 'INVALID_MONEY', errorMessage(error))];
  }
  try {
    discountBps = discountPercentToBps(value.discount_percent);
  } catch (error) {
    return [rowError(context.row, 'discount_percent', 'INVALID_DISCOUNT', errorMessage(error))];
  }
  try {
    offeredAt = normalizeIsoTimestamp(value.offered_at);
  } catch (error) {
    return [rowError(context.row, 'offered_at', 'INVALID_TIMESTAMP', errorMessage(error))];
  }
  try {
    promisedAt = value.promised_delivery_at ? normalizeIsoTimestamp(value.promised_delivery_at) : null;
  } catch (error) {
    return [rowError(context.row, 'promised_delivery_at', 'INVALID_TIMESTAMP', errorMessage(error))];
  }

  const existing = await getSupplierOfferByExternalId(context.datasetId, value.offer_id);
  if (existing) {
    const identical =
      existing.order_id === order.value.id &&
      existing.supplier_id === supplier.id &&
      existing.product_id === product.value.id &&
      existing.available_qty === availableQty &&
      existing.unit_price_minor === price &&
      existing.discount_bps === discountBps &&
      nullableTimestampsEqual(existing.promised_delivery_at, promisedAt) &&
      timestampsEqual(existing.offered_at, offeredAt);
    return identical
      ? true
      : [rowError(context.row, 'offer_id', 'DUPLICATE_EXTERNAL_ID', 'The offer ID already belongs to different offer data.')];
  }

  await createSupplierOffer({
    dataset_id: context.datasetId,
    external_offer_id: value.offer_id,
    order_id: order.value.id,
    supplier_id: supplier.id,
    product_id: product.value.id,
    available_qty: availableQty,
    unit_price_minor: price,
    discount_bps: discountBps,
    promised_delivery_at: promisedAt,
    offered_at: offeredAt,
    source_ingestion_job_id: context.jobId,
  });
  return true;
}

async function importOutcomeRow(
  context: RowContext,
  caches: ReferenceCaches
): Promise<true | IngestionRowError[]> {
  const parsed = outcomeImportRowSchema.safeParse(context.row.values);
  if (!parsed.success) return zodErrorsToRows(parsed.error, context.row.rowNumber, context.row.values);
  const value = parsed.data;
  const order = await requireOrderReference(context, value.order_id, caches);
  if (!order.ok) return [order.error];
  const product = await requireProductReference(context, value.product_id, caches);
  if (!product.ok) return [product.error];
  const supplier = await requireSupplierReference(context, value.supplier_id, caches);
  if (!supplier.ok) return [supplier.error];

  let filledQty: number;
  let deliveredAt: string | null;
  let cancelled: boolean;
  let final: boolean;
  try {
    filledQty = parseNonNegativeInteger(value.filled_qty, 'filled_qty');
  } catch (error) {
    return [rowError(context.row, 'filled_qty', 'INVALID_QUANTITY', errorMessage(error))];
  }
  try {
    deliveredAt = value.delivered_at ? normalizeIsoTimestamp(value.delivered_at) : null;
  } catch (error) {
    return [rowError(context.row, 'delivered_at', 'INVALID_TIMESTAMP', errorMessage(error))];
  }
  try {
    cancelled = parseStrictBoolean(value.cancelled);
    final = parseStrictBoolean(value.outcome_final);
  } catch (error) {
    return [rowError(context.row, 'outcome_final', 'INVALID_BOOLEAN', errorMessage(error))];
  }

  const existing = await getOrderOutcomeByReferences(
    context.datasetId,
    order.value.id,
    supplier.value.id,
    product.value.id
  );
  const outcomeValues = {
    filled_qty: filledQty,
    delivered_at: deliveredAt,
    cancelled,
    cancellation_reason: value.cancellation_reason || null,
    outcome_final: final,
    source_ingestion_job_id: context.jobId,
  };
  if (!existing) {
    await createOrderOutcome({
      dataset_id: context.datasetId,
      order_id: order.value.id,
      supplier_id: supplier.value.id,
      product_id: product.value.id,
      ...outcomeValues,
    });
    return true;
  }

  const identical =
    existing.filled_qty === filledQty &&
    nullableTimestampsEqual(existing.delivered_at, deliveredAt) &&
    existing.cancelled === cancelled &&
    (existing.cancellation_reason ?? null) === (value.cancellation_reason || null) &&
    existing.outcome_final === final;
  if (identical) return true;
  if (existing.outcome_final) {
    return [rowError(context.row, 'outcome_final', 'FINAL_OUTCOME_CONFLICT', 'A final outcome cannot be changed or regressed.')];
  }
  if (!final) {
    return [rowError(context.row, 'outcome_final', 'CONFLICTING_RECORD', 'A non-final outcome may only change by advancing to final.')];
  }
  await advanceOrderOutcome(existing.id, outcomeValues);
  return true;
}

async function importDecisionRow(
  context: RowContext,
  caches: ReferenceCaches
): Promise<true | IngestionRowError[]> {
  const parsed = decisionImportRowSchema.safeParse(context.row.values);
  if (!parsed.success) return zodErrorsToRows(parsed.error, context.row.rowNumber, context.row.values);
  const value = parsed.data;
  const order = await requireOrderReference(context, value.order_id, caches);
  if (!order.ok) return [order.error];
  const supplier = await requireSupplierReference(context, value.selected_supplier_id, caches);
  if (!supplier.ok) return [supplier.error];

  let decidedAt: string;
  let confidence: string | null;
  try {
    decidedAt = normalizeIsoTimestamp(value.decided_at);
  } catch (error) {
    return [rowError(context.row, 'decided_at', 'INVALID_TIMESTAMP', errorMessage(error))];
  }
  try {
    confidence = normalizeConfidence(value.confidence);
  } catch (error) {
    return [rowError(context.row, 'confidence', 'INVALID_CONFIDENCE', errorMessage(error))];
  }

  const existing = await getAiDecisionByExternalId(context.datasetId, value.decision_id);
  if (existing) {
    return decisionMatches(existing, order.value.id, supplier.value.id, decidedAt, value, confidence)
      ? true
      : [rowError(context.row, 'decision_id', 'DUPLICATE_EXTERNAL_ID', 'The decision ID already belongs to different decision data.')];
  }
  await createAiDecision({
    dataset_id: context.datasetId,
    external_decision_id: value.decision_id,
    order_id: order.value.id,
    selected_supplier_id: supplier.value.id,
    decided_at: decidedAt,
    agent_name: value.agent_name || null,
    agent_version: value.agent_version || null,
    confidence,
    selection_reason: value.selection_reason || null,
    source_ingestion_job_id: context.jobId,
  });
  return true;
}

function decisionMatches(
  existing: AiDecisionRow,
  orderId: string,
  supplierId: string,
  decidedAt: string,
  value: { agent_name: string; agent_version: string; selection_reason: string },
  confidence: string | null
): boolean {
  return (
    existing.order_id === orderId &&
    existing.selected_supplier_id === supplierId &&
    timestampsEqual(existing.decided_at, decidedAt) &&
    (existing.agent_name ?? null) === (value.agent_name || null) &&
    (existing.agent_version ?? null) === (value.agent_version || null) &&
    decimalEqual(existing.confidence, confidence) &&
    (existing.selection_reason ?? null) === (value.selection_reason || null)
  );
}

async function cachedPharmacy(datasetId: string, externalId: string, caches: ReferenceCaches) {
  if (!caches.pharmacies.has(externalId)) {
    caches.pharmacies.set(externalId, await getPharmacyByExternalId(datasetId, externalId));
  }
  return caches.pharmacies.get(externalId) ?? null;
}

async function cachedProduct(datasetId: string, externalId: string, caches: ReferenceCaches) {
  if (!caches.products.has(externalId)) {
    caches.products.set(externalId, await getProductByExternalId(datasetId, externalId));
  }
  return caches.products.get(externalId) ?? null;
}

async function cachedSupplier(datasetId: string, externalId: string, caches: ReferenceCaches) {
  if (!caches.suppliers.has(externalId)) {
    caches.suppliers.set(externalId, await getSupplierByExternalId(datasetId, externalId));
  }
  return caches.suppliers.get(externalId) ?? null;
}

async function cachedOrder(datasetId: string, externalId: string, caches: ReferenceCaches) {
  if (!caches.orders.has(externalId)) {
    caches.orders.set(externalId, await getOrderByExternalId(datasetId, externalId));
  }
  return caches.orders.get(externalId) ?? null;
}

async function requireOrderReference(context: RowContext, externalId: string, caches: ReferenceCaches) {
  const value = await cachedOrder(context.datasetId, externalId, caches);
  if (value) return { ok: true as const, value };
  const cross = await existsOutsideDataset('order', context.datasetId, externalId, caches);
  return {
    ok: false as const,
    error: rowError(
      context.row,
      'order_id',
      cross ? 'CROSS_DATASET_REFERENCE' : 'UNKNOWN_ORDER',
      cross ? 'The order exists in another dataset.' : 'The order does not exist in this dataset.'
    ),
  };
}

async function requireProductReference(context: RowContext, externalId: string, caches: ReferenceCaches) {
  const value = await cachedProduct(context.datasetId, externalId, caches);
  if (value) return { ok: true as const, value };
  const cross = await existsOutsideDataset('product', context.datasetId, externalId, caches);
  return {
    ok: false as const,
    error: rowError(
      context.row,
      'product_id',
      cross ? 'CROSS_DATASET_REFERENCE' : 'UNKNOWN_PRODUCT',
      cross ? 'The product exists in another dataset.' : 'The product does not exist in this dataset.'
    ),
  };
}

async function requireSupplierReference(context: RowContext, externalId: string, caches: ReferenceCaches) {
  const value = await cachedSupplier(context.datasetId, externalId, caches);
  if (value) return { ok: true as const, value };
  const cross = await existsOutsideDataset('supplier', context.datasetId, externalId, caches);
  return {
    ok: false as const,
    error: rowError(
      context.row,
      'supplier_id',
      cross ? 'CROSS_DATASET_REFERENCE' : 'UNKNOWN_SUPPLIER',
      cross ? 'The supplier exists in another dataset.' : 'The supplier does not exist in this dataset.'
    ),
  };
}

type ReferenceEntity = 'order' | 'product' | 'supplier' | 'pharmacy';

async function existsOutsideDataset(
  entity: ReferenceEntity,
  datasetId: string,
  externalId: string,
  caches: ReferenceCaches
): Promise<boolean> {
  const cacheKey = `${entity}:${externalId}`;
  if (caches.globalReferences.has(cacheKey)) return caches.globalReferences.get(cacheKey) ?? false;

  const supabase = getSupabaseServerClient();
  const query =
    entity === 'order'
      ? supabase.from('orders').select('id').eq('external_order_id', externalId)
      : entity === 'product'
        ? supabase.from('products').select('id').eq('external_product_id', externalId)
        : entity === 'supplier'
          ? supabase.from('suppliers').select('id').eq('external_supplier_id', externalId)
          : supabase.from('pharmacies').select('id').eq('external_pharmacy_id', externalId);
  const { data, error } = await query.neq('dataset_id', datasetId).limit(1);
  if (error) throw error;
  const exists = (data?.length ?? 0) > 0;
  caches.globalReferences.set(cacheKey, exists);
  return exists;
}

function rowError(
  row: ParsedCsvRow,
  field: string | null,
  code: RowErrorCode,
  message: string
): IngestionRowError {
  return {
    rowNumber: row.rowNumber,
    field,
    code,
    message,
    rawValue: field ? (row.values[field] ?? null) : null,
  };
}

function timestampsEqual(left: string, right: string): boolean {
  return normalizeIsoTimestamp(left) === normalizeIsoTimestamp(right);
}

function nullableTimestampsEqual(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  return timestampsEqual(left, right);
}

function decimalEqual(left: number | null, right: string | null): boolean {
  if (left === null || right === null) return left === null && right === null;
  return canonicalDecimal(String(left)) === canonicalDecimal(right);
}

function canonicalDecimal(input: string): string {
  return input.includes('.') ? input.replace(/0+$/, '').replace(/\.$/, '') : input;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The value is invalid.';
}

function elapsed(started: number): number {
  return Math.round((performance.now() - started) * 100) / 100;
}
