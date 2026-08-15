import { ApiError } from './supabase-api';

/**
 * Affiche un toast d'erreur normalisé pour les erreurs API.
 * Élimine la duplication de 18+ blocs catch identiques.
 */
export function apiToast(
  toast: { error: (title: string, detail?: string) => void },
  err: unknown,
  fallback: string,
): void {
  toast.error(fallback, err instanceof ApiError ? err.message : undefined);
}
