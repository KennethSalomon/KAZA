import { defineConfig, devices } from '@playwright/test';

// note : tests E2E du parcours principal (recherche → chat → bail → paiement → quittance).
// Requiert : Supabase local (npx supabase start + supabase db reset) — pas de backend.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});