import { getSupabaseServerClient } from '../../supabase/server';
import type { DataSourceRow } from '../row-types';
import { requireData } from './result';

const IMPORT_SOURCE_NAME = 'Canonical CSV Imports';

export async function getOrCreateCsvImportSource(datasetId: string): Promise<DataSourceRow> {
  const supabase = getSupabaseServerClient();
  const existing = await supabase
    .from('data_sources')
    .select('*')
    .eq('dataset_id', datasetId)
    .eq('kind', 'CSV')
    .eq('acquisition_mode', 'FILE_IMPORT')
    .eq('name', IMPORT_SOURCE_NAME)
    .limit(1)
    .maybeSingle();

  if (existing.error) requireData(existing.data, existing.error, 'Find CSV import source');
  if (existing.data) return existing.data;

  const created = await supabase
    .from('data_sources')
    .insert({
      dataset_id: datasetId,
      kind: 'CSV',
      acquisition_mode: 'FILE_IMPORT',
      name: IMPORT_SOURCE_NAME,
      status: 'READY',
    })
    .select('*')
    .single();
  return requireData(created.data, created.error, 'Create CSV import source');
}

export async function markImportSourceIngested(sourceId: string, completedAt: string): Promise<void> {
  const { error } = await getSupabaseServerClient()
    .from('data_sources')
    .update({ status: 'READY', last_ingested_at: completedAt })
    .eq('id', sourceId);
  if (error) requireData(null, error, 'Update CSV import source');
}
