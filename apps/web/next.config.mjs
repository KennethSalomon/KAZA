/* eslint-disable */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';

const workspaceRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

// CSP : domaine public KAZA / Supabase (storage, auth, realtime) / tuiles OpenStreetMap.
// 'unsafe-inline' autorisé UNIQUEMENT pour les styles (next/font, Leaflet) et en DEV
// (react-refresh). En production, script-src interdit tout script inline : un XSS
// ne peut pas exécuter de payload injecté (protection du JWT de session).
const isDev = process.env.NODE_ENV === 'development';
const CSP = [
  "default-src 'self'",
  `script-src 'self'${isDev ? " 'unsafe-inline' 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.supabase.co https://images.unsplash.com https://*.tile.openstreetmap.org",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
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
});