import { getAdminClient } from './db.ts';

export interface AuthUser {
  id: string;
  email: string | null;
  role: 'visiteur' | 'locataire' | 'bailleur' | 'admin';
}

/**
 * Vérifie le Bearer token JWT (session Supabase) et retourne l'utilisateur
 * avec son rôle issu de la table profiles (source de vérité).
 */
export async function requireUser(req: Request): Promise<AuthUser> {
  const auth = req.headers.get('Authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw new Error('Authentification requise');

  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Session invalide');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', data.user.id)
    .maybeSingle();

  return {
    id: data.user.id,
    email: profile?.email ?? data.user.email ?? null,
    role: profile?.role ?? 'visiteur',
  };
}
