import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

let client: SupabaseClient | null = null;

/**
 * Client Supabase avec la clé service_role (bypass RLS).
 * Utilisé uniquement côté Edge Functions — jamais exposé au navigateur.
 */
export function getAdminClient(): SupabaseClient {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants');
  }
  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
