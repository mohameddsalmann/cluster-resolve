import { getSupabaseServerClient } from '../supabase/server';
import { ImportJobError } from './errors';

export const IMPORT_BUCKET = 'procurement-imports';
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop()?.trim() ?? '';
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '');
  return (safe || 'import.csv').slice(0, 180);
}

export function importStoragePath(datasetId: string, jobId: string, filename: string): string {
  return `imports/${datasetId}/${jobId}/${sanitizeFilename(filename)}`;
}

export async function createSignedImportUpload(path: string) {
  const { data, error } = await getSupabaseServerClient()
    .storage.from(IMPORT_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data) {
    throw new ImportJobError('STORAGE_FAILED', 'Could not initialize the private file upload.');
  }
  return data;
}

export async function downloadImport(path: string): Promise<Uint8Array> {
  const { data, error } = await getSupabaseServerClient().storage.from(IMPORT_BUCKET).download(path);
  if (error || !data) {
    throw new ImportJobError('STORAGE_FAILED', 'The uploaded CSV could not be read from Storage.');
  }
  if (data.size > MAX_IMPORT_BYTES) {
    throw new ImportJobError('FILE_TOO_LARGE', 'CSV files may not exceed 10 MiB in Phase 3.');
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeImport(path: string): Promise<void> {
  const { error } = await getSupabaseServerClient().storage.from(IMPORT_BUCKET).remove([path]);
  if (error) {
    throw new ImportJobError('STORAGE_FAILED', 'The duplicate stored file could not be removed.');
  }
}
