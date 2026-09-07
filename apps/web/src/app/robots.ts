import type { MetadataRoute } from 'next';

// note : idem sitemap.ts — fallback pour éviter que /robots.txt ne casse
// le build quand NEXT_PUBLIC_APP_URL n'est pas encore configurée.
const FALLBACK_APP_URL = 'https://kaza.bj';

function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw || raw.includes('placeholder')) return FALLBACK_APP_URL;
  return raw.replace(/\/+$/, '');
}

// note : les crawlers doivent ignorer les zones authentifiées et les API —
// aucune valeur SEO et risque de tentatives d'indexation de pages d'erreur 401.
export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/explorer', '/login', '/register', '/confidentialite'],
        disallow: ['/api/', '/dashboard', '/landlord', '/profile', '/chat', '/favorites', '/admin'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
