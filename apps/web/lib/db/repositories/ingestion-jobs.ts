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

export async function createImportJob(params: CreateImportJobParams): Promise<IngestionJobRow> {
  const { data, error } = await getSupabaseServerClient()
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
    .single();
  return requireData(data, error, 'Create ingestion job');
}

export async function identifyImportJob(jobId: string, hash: string): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from('ingestion_jobs')
    .update({ file_sha256: hash })
    .eq('id', jobId);
  if (error) requireData(null, error, 'Identify ingestion job file');
}

export async function setImportJobStoragePath(jobId: string, path: string): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from('ingestion_jobs')
    .update({ storage_path: path })
    .eq('id', jobId);
  if (error) requireData(null, error, 'Set ingestion job storage path');
}

export async function getImportJob(jobId: string): Promise<IngestionJobRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('ingestion_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();
  if (error) requireData(data, error, 'Get ingestion job');
  return data;
}

export async function findActiveIdenticalImport(
  datasetId: string,
  kind: string,
  hash: string,
  exceptJobId: string
): Promise<IngestionJobRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('ingestion_jobs')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('kind', kind)
    .eq('file_sha256', hash)
    .in('status', ['PROCESSING', 'COMPLETED'])
    .neq('id', exceptJobId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) requireData(data, error, 'Find identical ingestion job');
  return data;
}

export async function startImportJob(jobId: string, hash: string, totalRows: number): Promise<void> {
  const { error } = await getSupabaseServerClient()
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
    .eq('id', jobId);
  if (error) requireData(null, error, 'Start ingestion job');
}

export async function completeImportJob(
  jobId: string,
  counts: { processed: number; valid: number; errors: number }
): Promise<string> {
  const finishedAt = new Date().toISOString();
  const { error } = await getSupabaseServerClient()
    .from('ingestion_jobs')
    .update({
      status: 'COMPLETED',
      processed_rows: counts.processed,
      valid_rows: counts.valid,
      error_rows: counts.errors,
      finished_at: finishedAt,
      error_message: null,
    })
    .eq('id', jobId);
  if (error) requireData(null, error, 'Complete ingestion job');
  return finishedAt;
}

export async function failImportJob(
  jobId: string,
  code: string,
  message: string,
  counts?: { processed: number; valid: number; errors: number }
): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from('ingestion_jobs')
    .update({
      status: 'FAILED',
      error_message: `${code}: ${message}`,
      processed_rows: counts?.processed,
      valid_rows: counts?.valid,
      error_rows: counts?.errors,
      finished_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (error) requireData(null, error, 'Fail ingestion job');
}

export async function deleteImportJob(jobId: string): Promise<void> {
  const { error } = await getSupabaseServerClient().from('ingestion_jobs').delete().eq('id', jobId);
  if (error) requireData(null, error, 'Delete duplicate ingestion job');
}
