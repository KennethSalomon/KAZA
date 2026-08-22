import { test, expect } from '@playwright/test';

// note : parcours locataire complet. Les identifiants de test doivent exister
// (seed : supabase/seed.sql) : locataire.demo@kaza.bj / bailleur.demo@kaza.bj
const TENANT_EMAIL = process.env.E2E_TENANT_EMAIL ?? 'locataire.demo@kaza.bj';
const TENANT_PW = process.env.E2E_TENANT_PW ?? 'KazaDemo2026!';
const LANDLORD_EMAIL = process.env.E2E_LANDLORD_EMAIL ?? 'bailleur.demo@kaza.bj';
const LANDLORD_PW = process.env.E2E_LANDLORD_PW ?? 'KazaDemo2026!';

test.describe('Parcours principal locataire', () => {
  test('recherche → contact → paiement → quittance', async ({ page }) => {
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

    // 6. Le bailleur confirme le paiement (déclenche création + signature quittance)
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Email').fill(LANDLORD_EMAIL);
    await page.getByLabel('Mot de passe').fill(LANDLORD_PW);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.goto('/landlord');
    await page.getByRole('button', { name: /Valider/ }).first().click();
    await expect(page.getByText('Paiement confirmé')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Signer et envoyer/ }).first().click();
    await expect(page.getByText('Quittance signée')).toBeVisible({ timeout: 10_000 });

    // 7. Reconnexion locataire : quittance signée visible dans "Mes quittances"
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Email').fill(TENANT_EMAIL);
    await page.getByLabel('Mot de passe').fill(TENANT_PW);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Mes quittances' })).toBeVisible();
    await expect(page.getByText('signée').first()).toBeVisible({ timeout: 15_000 });
  });

  test('recherche géolocalisée : bascule carte/liste et carte affichée', async ({ page }) => {
    await page.goto('/explorer');
    await page.getByRole('tab', { name: 'Carte' }).click();
    await expect(page.getByTestId('map')).toBeVisible();
    await expect(page.getByTestId('map')).toContainText('OpenStreetMap', { timeout: 10_000 });
  });
});
