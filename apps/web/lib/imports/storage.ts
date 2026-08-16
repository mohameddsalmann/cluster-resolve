import { getSupabaseServerClient } from '../supabase/server';
import { ImportJobError } from './errors';

export const IMPORT_BUCKET = 'procurement-imports';
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

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

async function retryStorage<T>(fn: () => PromiseLike<T>, retries = 3): Promise<T> {
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

export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop()?.trim() ?? '';
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '');
  return (safe || 'import.csv').slice(0, 180);
}

export function importStoragePath(datasetId: string, jobId: string, filename: string): string {
  return `imports/${datasetId}/${jobId}/${sanitizeFilename(filename)}`;
}

export async function createSignedImportUpload(path: string) {
  const { data, error } = await retryStorage(() =>
    getSupabaseServerClient()
      .storage.from(IMPORT_BUCKET)
      .createSignedUploadUrl(path, { upsert: false })
  );
  if (error || !data) {
    throw new ImportJobError('STORAGE_FAILED', 'Could not initialize the private file upload.');
  }
  return data;
}

export async function downloadImport(path: string): Promise<Uint8Array> {
  const { data, error } = await retryStorage(() =>
    getSupabaseServerClient().storage.from(IMPORT_BUCKET).download(path)
  );
  if (error || !data) {
    throw new ImportJobError('STORAGE_FAILED', 'The uploaded CSV could not be read from Storage.');
  }
  if (data.size > MAX_IMPORT_BYTES) {
    throw new ImportJobError('FILE_TOO_LARGE', 'CSV files may not exceed 10 MiB in Phase 3.');
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function removeImport(path: string): Promise<void> {
  const { error } = await retryStorage(() =>
    getSupabaseServerClient().storage.from(IMPORT_BUCKET).remove([path])
  );
  if (error) {
    throw new ImportJobError('STORAGE_FAILED', 'The duplicate stored file could not be removed.');
  }
}
