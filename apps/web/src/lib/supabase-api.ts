// ============================================================
// Couche d'accès « Supabase seule » — barrel export pour compatibilité.
// Le code métier a été découpé dans src/lib/api/ (auth, payments, chat, etc.).
// Ce fichier ré-exporte l'API publique inchangée pour ne pas casser les imports existants.
// ============================================================

import { supabase } from './supabase-client';
import { env } from './env';
import { withRetry } from './retry';

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string[]>;

  constructor(status: number, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/** Valide un numéro de téléphone bénin : +229 suivi de 10 chiffres. */
export function assertBeninPhone(phone: string): void {
  const cleaned = phone.replace(/\s+/g, '');
  if (!/^\+229\d{10}$/.test(cleaned)) {
    throw new ApiError(400, 'Numéro invalide — format attendu : +229 01 00 00 00 00');
  }
}

const PGRST_CODE = (code: string | undefined): number => {
  switch (code) {
    case 'P0001':
      return 409; // conflit métier (ex : limite freemium, caution trop élevée)
    case 'P0002':
      return 404;
    case '42501':
      return 403;
    default:
      return 400;
  }
};

export function normalizeError(err: unknown, fallback: string): ApiError {
  const e = err as { code?: string; message?: string; details?: string } | null;
  if (e?.message) {
    return new ApiError(PGRST_CODE(e.code), e.message);
  }
  if (e?.details) return new ApiError(400, e.details);
  return new ApiError(400, fallback);
}

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new ApiError(401, 'Session invalide — reconnectez-vous');

  const { data: { session } } = await supabase.auth.getSession();
  const base = env.supabaseUrl;

  return withRetry(
    async () => {
      const res = await fetch(`${base}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | T | null;
      if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`) as Error & { status: number };
        error.status = res.status;
        throw error;
      }
      return payload as T;
    },
    {
      maxRetries: 2,
      baseDelayMs: 500,
      retryableStatuses: [429, 500, 502, 503, 504],
    }
  );
}

export { callFunction };

// Ré-export de tous les modules d'API découpés
export * from './api';