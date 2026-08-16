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
  webServer: {
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.CI
      ? []
      : [{ name: 'mobile', use: { ...devices['iPhone 13'] } }]),
  ],
});