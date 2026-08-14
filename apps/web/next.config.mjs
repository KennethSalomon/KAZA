/* eslint-disable */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workspaceRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

// CSP : domaine public KAZA / Supabase (storage, auth, realtime) / tuiles OpenStreetMap.
// 'unsafe-inline' requis par les styles injectés de next/font et Leaflet.
// 'unsafe-eval' uniquement en DEV (react-refresh/webpack) — jamais en production.
const isDev = process.env.NODE_ENV === 'development';
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.supabase.co https://images.unsplash.com https://*.tile.openstreetmap.org",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org",
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

export default nextConfig;