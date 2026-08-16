import { test, expect } from '@playwright/test';

// note : parcours locataire complet. Les identifiants de test doivent exister
// (seed : supabase/seed.sql) : locataire.demo@kaza.bj / bailleur.demo@kaza.bj
const TENANT_EMAIL = process.env.E2E_TENANT_EMAIL ?? 'locataire.demo@kaza.bj';
const TENANT_PW = process.env.E2E_TENANT_PW ?? 'KazaDemo2026!';

test.describe('Parcours principal locataire', () => {
  test('recherche → contact → paiement → quittance', async ({ page }) => {
    page.on('pageerror', (err) => console.log('[KAZA:PAGEERROR]', err.message));
    page.on('response', async (res) => {
      const u = res.url();
      if (u.includes('/rest/v1/messages') || u.includes('/rest/v1/conversations') || u.includes('/api/login')) {
        const status = res.status();
        const body = await res.text().catch(() => '');
        console.log('[KAZA:RES]', status, u.replace('http://localhost:3000', '').replace('http://localhost:54321', ''), body.slice(0, 200));
      }
    });
    // 1. Exploration : la recherche affiche les biens libres
    await page.goto('/explorer');
    await expect(page.getByRole('heading', { name: /Trouvez votre prochain logement/ })).toBeVisible();

    // 2. Connexion
    await page.goto('/login');
    await page.getByLabel('Email').fill(TENANT_EMAIL);
    await page.getByLabel('Mot de passe').fill(TENANT_PW);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/explorer/);

    // 3. Ouvrir le premier bien et contacter le bailleur
    await page.goto('/explorer');
    await expect(page.locator('article').first()).toBeVisible();
    await page.locator('article').first().click();
    await page.getByTestId('contact-owner').click();
    await expect(page).toHaveURL(/\/chat\//);

    // 4. Envoyer un message dans le chat
    await page.getByLabel('Message').fill('Bonjour, je souhaite visiter le bien. Merci !');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText('Bonjour, je souhaite visiter')).toBeVisible();

    // 5. Payer le loyer (mode sandbox)
    await page.goto('/dashboard');
    await page.getByTestId('pay-loyer').first().click();
    await page.getByRole('tab', { name: 'Espèces' }).click();
    await page.getByRole('button', { name: /Signaler le paiement/ }).click();
    await expect(page.getByText('Paiement signalé')).toBeVisible();

    // 6. Quittance signée (validation bailleur) — visible dans l'espace locataire
    await page.goto('/dashboard');
    await expect(page.getByText(/Quittance de/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('recherche géolocalisée : bascule carte/liste et carte affichée', async ({ page }) => {
    await page.goto('/explorer');
    await page.getByRole('tab', { name: 'Carte' }).click();
    await expect(page.getByTestId('map')).toBeVisible();
    await expect(page.getByTestId('map')).toContainText('OpenStreetMap', { timeout: 10_000 });
  });
});
