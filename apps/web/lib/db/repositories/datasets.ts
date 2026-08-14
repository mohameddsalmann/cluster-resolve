import { getSupabaseServerClient } from '../../supabase/server';
import type { DatasetMode, DatasetRow } from '../row-types';
import { requireData } from './result';

export interface CreateDatasetParams {
  name: string;
  mode: DatasetMode;
  description?: string | null;
}

export async function createDataset(params: CreateDatasetParams): Promise<DatasetRow> {
  const { data, error } = await getSupabaseServerClient()
    .from('datasets')
    .insert({
      name: params.name,
      mode: params.mode,
      description: params.description ?? null,
    })
    .select('id, name, mode, description, created_at')
    .single();

  return requireData(data, error, 'Create dataset') as DatasetRow;
}

export async function getDatasetById(id: string): Promise<DatasetRow | null> {
  const { data, error } = await getSupabaseServerClient()
    .from('datasets')
    .select('id, name, mode, description, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    requireData(data, error, 'Get dataset');
  }
  return data as DatasetRow | null;
}

export async function listDatasets(): Promise<DatasetRow[]> {
  const { data, error } = await getSupabaseServerClient()
    .from('datasets')
    .select('id, name, mode, description, created_at')
    .order('created_at', { ascending: false });

  return requireData(data, error, 'List datasets') as DatasetRow[];
}
