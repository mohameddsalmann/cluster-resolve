import type { PostgrestError } from '@supabase/supabase-js';

export function requireData<T>(
  data: T | null,
  error: PostgrestError | null,
  operation: string
): T {
  if (error) {
    const repositoryError = new Error(`${operation} failed: ${error.message}`);
    Object.assign(repositoryError, {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw repositoryError;
  }
  if (data === null) {
    throw new Error(`${operation} failed: Supabase returned no data.`);
  }
  return data;
}
