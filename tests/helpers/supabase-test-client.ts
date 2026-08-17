import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { existsSync } from 'fs';

// Load .env.test only if it exists (local dev); CI injects vars via env
if (existsSync('.env.test')) {
  config({ path: '.env.test' });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase keys — set NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY ' +
    'in .env.test (local) or as CI env vars / GitHub secrets.'
  );
}

export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function resetDatabase() {
  const { error } = await supabaseAdmin.rpc('reset_test_database');
  if (error && !error.message.includes('does not exist')) {
    console.warn('reset_test_database RPC not available, manual cleanup may be needed');
  }
}

export async function createTestUser(role: 'locataire' | 'bailleur' | 'admin' = 'locataire') {
  const email = `test_${role}_${Date.now()}_${Math.random().toString(36).slice(2)}@kaza.test`;
  const password = 'TestPass123!';

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `Test ${role}`,
      phone: '+2290100000000',
      role,
      consent_apdp: true,
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('User creation failed');

  return { user: authData.user, email, password };
}

export async function signInTestUser(email: string, password: string) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function deleteTestUser(userId: string) {
  await supabaseAdmin.auth.admin.deleteUser(userId);
}

export function getAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}