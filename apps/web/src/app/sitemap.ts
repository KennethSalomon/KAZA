import type { MetadataRoute } from 'next';

// note : le sitemap est généré au build. On lit directement process.env
// (SANS passer par lib/env, qui throw si NEXT_PUBLIC_APP_URL manque) car
// une URL de fallback rend un sitemap valide plutôt que de faire crasher
// tout le build. En prod configurée, la variable Vercel écrase le fallback.
const FALLBACK_APP_URL = 'https://kaza.bj';

function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw || raw.includes('placeholder')) return FALLBACK_APP_URL;
  return raw.replace(/\/+$/, '');
}

// note : sitemap statique — les routes publiques indexables uniquement.
// Les pages privées (dashboard, landlord, chat…) sont exclues : protégées
// par middleware auth, elles renverraient 401 aux crawlers.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/explorer`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/login`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/register`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${base}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
