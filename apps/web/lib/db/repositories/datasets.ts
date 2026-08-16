import { getSupabaseServerClient } from '../../supabase/server';
import type { DatasetMode, DatasetRow } from '../row-types';
import { requireData } from './result';

export interface CreateDatasetParams {
  name: string;
  mode: DatasetMode;
  description?: string | null;
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

export async function createDataset(params: CreateDatasetParams): Promise<DatasetRow> {
  const { data, error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('datasets')
      .insert({
        name: params.name,
        mode: params.mode,
        description: params.description ?? null,
      })
      .select('id, name, mode, description, created_at')
      .single()
  );

  return requireData(data, error, 'Create dataset') as DatasetRow;
}

export async function getDatasetById(id: string): Promise<DatasetRow | null> {
  const { data, error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('datasets')
      .select('id, name, mode, description, created_at')
      .eq('id', id)
      .maybeSingle()
  );

  if (error) {
    requireData(data, error, 'Get dataset');
  }
  return data as DatasetRow | null;
}

export async function listDatasets(): Promise<DatasetRow[]> {
  const { data, error } = await retryQuery(() =>
    getSupabaseServerClient()
      .from('datasets')
      .select('id, name, mode, description, created_at')
      .order('created_at', { ascending: false })
  );

  const rawList = requireData(data, error, 'List datasets') as DatasetRow[];

  // Filter out transient test datasets created by automated integration test suites
  const filtered = rawList.filter((d) => {
    return !/^(Integration Test|Chunk 4 Integration|Constraint Test|Phase 3 Cross Dataset|Test chunk2 debug)/i.test(d.name);
  });

  // Pin the full 10,000-order Founder Demo dataset to the top
  filtered.sort((a, b) => {
    if (a.name === 'Cluster Resolve · Founder Demo') return -1;
    if (b.name === 'Cluster Resolve · Founder Demo') return 1;
    return 0;
  });

  return filtered;
}
