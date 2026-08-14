import { getSupabaseServerClient } from '../../supabase/server';
import type { IngestionRowError } from '../../imports/errors';
import type { IngestionErrorRow } from '../row-types';
import { requireData } from './result';

export async function replaceIngestionErrors(
  jobId: string,
  errors: IngestionRowError[]
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const deleted = await supabase.from('ingestion_errors').delete().eq('job_id', jobId);
  if (deleted.error) requireData(null, deleted.error, 'Clear ingestion errors');

  for (let index = 0; index < errors.length; index += 250) {
    const rows = errors.slice(index, index + 250).map((error) => ({
      job_id: jobId,
      row_number: error.rowNumber,
      field: error.field,
      code: error.code,
      message: error.message,
      raw_value: error.rawValue,
    }));
    const inserted = await supabase.from('ingestion_errors').insert(rows);
    if (inserted.error) requireData(null, inserted.error, 'Persist ingestion errors');
  }
}

export async function listIngestionErrors(
  jobId: string,
  afterRow: number,
  limit: number
): Promise<IngestionErrorRow[]> {
  const { data, error } = await getSupabaseServerClient()
    .from('ingestion_errors')
    .select('*')
    .eq('job_id', jobId)
    .gt('row_number', afterRow)
    .order('row_number')
    .limit(limit);
  return requireData(data, error, 'List ingestion errors') as IngestionErrorRow[];
}
