import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../db/generated-types';

if (typeof window !== 'undefined') {
  throw new Error('The privileged Supabase client is server-only.');
}

let serverClient: SupabaseClient<Database> | null = null;

export function getSupabaseServerClient(): SupabaseClient<Database> {
  if (serverClient) {
    return serverClient;
  }

  const url = process.env.SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL is required for server-side Supabase access.');
  }
  if (!secretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required for server-side Supabase access.'
    );
  }

  serverClient = createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return serverClient;
}
