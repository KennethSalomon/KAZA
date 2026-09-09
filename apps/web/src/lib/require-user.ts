import { supabase } from './supabase-client';

/**
 * Extract authenticated user from the browser session.
 * Throws a user-facing error if not authenticated.
 * Centralizes the repeated getUser + null-check pattern across API modules.
 */
export async function requireUser(): Promise<{ id: string; email: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Connectez-vous pour effectuer cette action');
  return { id: user.id, email: user.email ?? null };
}
