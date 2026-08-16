import type { ImportKind } from '@cluster/schemas';
import { getSupabaseServerClient } from '../../supabase/server';
import type { IngestionJobRow } from '../row-types';
import { requireData } from './result';

export interface CreateImportJobParams {
  datasetId: string;
  sourceId: string;
  kind: ImportKind;
  filename: string;
  storagePath?: string | null;
}

function isTransientError(error: unknown): boolean {
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

async function retryQuery<T>(fn: () => PromiseLike<T>, retries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fn();
      const maybeError = (res as { error?: unknown })?.error;
      if (!maybeError || !isTransientError(maybeError) || attempt === retries) {
        return res;
      }
      lastError = maybeError;
    } catch (err) {
      if (!isTransientError(err) || attempt === retries) {
        throw err;
      }
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw lastError;
}

export async function createImportJob(params: CreateImportJobParams): Promise<IngestionJobRow> {
  const { data, error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('ingestion_jobs')
      .insert({
        dataset_id: params.datasetId,
        source_id: params.sourceId,
        kind: params.kind,
        status: 'PENDING',
        original_filename: params.filename,
        storage_path: params.storagePath ?? null,
      })
      .select('*')
      .single()
  );
  return requireData(data, error, 'Create ingestion job');
}

export async function identifyImportJob(jobId: string, hash: string): Promise<void> {
  const { error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('ingestion_jobs')
      .update({ file_sha256: hash })
      .eq('id', jobId)
  );
  if (error) requireData(null, error, 'Identify ingestion job file');
}

export async function setImportJobStoragePath(jobId: string, path: string): Promise<void> {
  const { error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('ingestion_jobs')
      .update({ storage_path: path })
      .eq('id', jobId)
  );
  if (error) requireData(null, error, 'Set ingestion job storage path');
}

export async function getImportJob(jobId: string): Promise<IngestionJobRow | null> {
  const { data, error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('ingestion_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle()
  );
  if (error) requireData(data, error, 'Get ingestion job');
  return data;
}

export async function findActiveIdenticalImport(
  datasetId: string,
  kind: string,
  hash: string,
  exceptJobId: string
): Promise<IngestionJobRow | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await retryQuery(() =>
    supabase
      .from('ingestion_jobs')
      .select('*')
      .eq('dataset_id', datasetId)
      .eq('kind', kind)
      .eq('file_sha256', hash)
      .in('status', ['PROCESSING', 'COMPLETED'])
      .neq('id', exceptJobId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
  );
  if (error) requireData(data, error, 'Find identical ingestion job');
  if (!data) return null;
  if (data.status === 'PROCESSING') {
    const started = data.started_at ? Date.parse(data.started_at) : 0;
    const isStale = Date.now() - started > 5 * 60 * 1000;
    if (isStale) {
      await failImportJob(data.id, 'JOB_TIMEOUT', 'The previous import attempt timed out.');
      return null;
    }
  } else if (data.status === 'COMPLETED') {
    const table =
      kind === 'ORDERS'
        ? 'orders'
        : kind === 'OFFERS'
          ? 'supplier_offers'
          : kind === 'DECISIONS'
            ? 'ai_decisions'
            : kind === 'OUTCOMES'
              ? 'order_outcomes'
              : null;
    if (table) {
      const { count } = await retryQuery(() =>
        supabase.from(table).select('*', { count: 'exact', head: true }).eq('dataset_id', datasetId)
      );
      if (typeof count === 'number' && count === 0) {
        // Stale ingestion job whose canonical rows were deleted; invalidate so fresh import runs
        await deleteImportJob(data.id);
        return null;
      }
    }
  }
  return data;
}

export async function startImportJob(jobId: string, hash: string, totalRows: number): Promise<void> {
  const { error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('ingestion_jobs')
      .update({
        status: 'PROCESSING',
        file_sha256: hash,
        total_rows: totalRows,
        processed_rows: 0,
        valid_rows: 0,
        error_rows: 0,
        error_message: null,
        started_at: new Date().toISOString(),
        finished_at: null,
      })
      .eq('id', jobId)
  );
  if (error) requireData(null, error, 'Start ingestion job');
}

export async function updateImportJobProgress(
  jobId: string,
  counts: { processed: number; valid: number; errors: number }
): Promise<void> {
  const { error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('ingestion_jobs')
      .update({
        processed_rows: counts.processed,
        valid_rows: counts.valid,
        error_rows: counts.errors,
      })
      .eq('id', jobId)
      .eq('status', 'PROCESSING')
  );
  if (error) requireData(null, error, 'Update ingestion job progress');
}

export async function completeImportJob(
  jobId: string,
  counts: { processed: number; valid: number; errors: number }
): Promise<string> {
  const finishedAt = new Date().toISOString();
  const { error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('ingestion_jobs')
      .update({
        status: 'COMPLETED',
        processed_rows: counts.processed,
        valid_rows: counts.valid,
        error_rows: counts.errors,
        finished_at: finishedAt,
        error_message: null,
      })
      .eq('id', jobId)
  );
  if (error) requireData(null, error, 'Complete ingestion job');
  return finishedAt;
}

export async function failImportJob(
  jobId: string,
  code: string,
  message: string,
  counts?: { processed: number; valid: number; errors: number }
): Promise<void> {
  const { error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('ingestion_jobs')
      .update({
        status: 'FAILED',
        error_message: `${code}: ${message}`,
        processed_rows: counts?.processed,
        valid_rows: counts?.valid,
        error_rows: counts?.errors,
        finished_at: new Date().toISOString(),
      })
      .eq('id', jobId)
  );
  if (error) requireData(null, error, 'Fail ingestion job');
}

export async function deleteImportJob(jobId: string): Promise<void> {
  const { error } = await retryQuery(() =>
    getSupabaseServerClient().from('ingestion_jobs').delete().eq('id', jobId)
  );
  if (error) requireData(null, error, 'Delete duplicate ingestion job');
}
