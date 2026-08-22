/* eslint-disable */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';

const workspaceRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

// CSP : domaine public KAZA / Supabase (storage, auth, realtime) / tuiles OpenStreetMap.
// NOTE : en App Router, Next.js 15 streamant le payload RSC dans des scripts
// inline (self.__next_f) → `'unsafe-inline'` est REQUIS en script-src (le
// nonce auto — experimental.csp — n'existe qu'à partir de Next 16). La
// protection XSS reste assurée par l'absence de toute source externe, le
// middleware d'auth et le React escaping par défaut.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.hcaptcha.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: http://localhost:54321 https://*.supabase.co https://images.unsplash.com https://*.tile.openstreetmap.org",
  "connect-src 'self' http://localhost:54321 wss://localhost:54321 https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://api.hcaptcha.com https://js.hcaptcha.com https://*.hcaptcha.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  "frame-src https://*.hcaptcha.com",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "report-uri /api/csp-report",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: workspaceRoot,
  images: {
    remotePatterns: [
      // photos stockées dans Supabase Storage (public)
      { protocol: 'https', hostname: '**supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
});
