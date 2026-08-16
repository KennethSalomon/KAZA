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
 *     PAT Supabase (sbp_*), tokens Vercel (vcp_*)…
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

  // hCaptcha est OPTIONNEL : sans sitekey le widget est simplement désactivé
  // (utile en local, CI e2e, ou tant que Supabase n'exige pas de captcha).
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

export const env = {
  supabaseUrl: resolvePublic('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: resolvePublic('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  appUrl: resolvePublic('NEXT_PUBLIC_APP_URL'),
  // Sitekey hCaptcha : PUBLIQUE par design (embarquée dans le bundle pour
  // exécuter le widget). Requise en production : si l'API Supabase a le
  // captcha activé, toute requête auth sans token est rejetée (400).
  hcaptchaSitekey: resolvePublic('NEXT_PUBLIC_HCAPTCHA_SITEKEY'),
} as const;
