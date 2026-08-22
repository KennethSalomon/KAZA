/**
 * Validation stricte des variables d'environnement publiques (KAZA).
 *
 * IMPORTANT (build Next.js) : l'accès se fait par clé STATIQUE
 * (`process.env.NEXT_PUBLIC_...` littéral) — le bundler remplace
 * uniquement les accès littéraux. `process.env[cleDynamique]` n'est
 * JAMAIS inliné → vide côté navigateur → hydratation brisée.
 *
 * Règle d'or : une variable NEXT_PUBLIC_* est embarquée dans le bundle
 * navigateur. Elle est donc PUBLIQUE PAR DESIGN. N'y déclarer JAMAIS :
 *   - service_role key, FedaPay (sk_live_*), Brevo (xkeysib-*), CRON_SECRET,
 *     PAT Supabase (sbp_*), tokens Vercel (vcp_*)...
 *   - UPSTASH_REDIS_URL/TOKEN (secrets serveur)
 *
 * En production, toute variable manquante ou placeholder = build refusé.
 * Aucun échec silencieux n'est toléré.
 */

const DEV_FALLBACKS = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_HCAPTCHA_SITEKEY: '',
} as const;

// Accès littéraux et statiques : remplacés par le bundler au build-time.
const RAW = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_HCAPTCHA_SITEKEY: process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY,
} as const;

function resolvePublic(name: keyof typeof RAW): string {
  const value = RAW[name];
  const devFallback = DEV_FALLBACKS[name];

  if (name === 'NEXT_PUBLIC_HCAPTCHA_SITEKEY') {
    return value ?? devFallback;
  }

  if (process.env.NODE_ENV === 'production') {
    if (!value || value === devFallback || value.includes('placeholder')) {
      throw new Error(
        `[KAZA:ENV] ${name} est manquante, placeholder ou non définie en production. ` +
          `Configurez-la dans Vercel → Settings → Environment Variables. Build refusé.`,
      );
    }
    return value;
  }

  return value ?? devFallback;
}

// Variables serveur (NON publiques) — disponibles seulement côté serveur
function resolveServer(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') {
    return fallback;
  }
  return value ?? fallback;
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/g, '');
}

export const env = {
  supabaseUrl: normalizeUrl(resolvePublic('NEXT_PUBLIC_SUPABASE_URL')),
  supabaseAnonKey: resolvePublic('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  appUrl: normalizeUrl(resolvePublic('NEXT_PUBLIC_APP_URL')),
  hcaptchaSitekey: resolvePublic('NEXT_PUBLIC_HCAPTCHA_SITEKEY'),
  // Upstash Redis (server-only)
  upstashRedisUrl: resolveServer('UPSTASH_REDIS_URL'),
  upstashRedisToken: resolveServer('UPSTASH_REDIS_TOKEN'),
} as const;
