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
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill(TENANT_PW);
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
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill(LANDLORD_PW);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    // Attendre la navigation résultant du login (même mécanisme que le login
    // locataire) : sans cela, page.goto('/landlord') peut partir avant que la
    // session soit propagée côté AuthProvider → middleware redirige vers login.
    await expect(page).toHaveURL(/\/explorer/);
    await page.goto('/landlord');
    await expect(page.getByTestId('validate-payment').first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId('validate-payment').first().click();
    await expect(page.getByText('Paiement confirmé')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('sign-receipt').first()).toBeVisible({
      timeout: 15_000,
    });

    // Observation réseau du clic : distingue un échec réel de la Edge
    // Function (status != 2xx) d'un simple problème de toast/selector.
    // Aucun JWT ni secret n'est affiché — uniquement le statut HTTP.
    const signResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/functions/v1/receipts-sign') && resp.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByTestId('sign-receipt').first().click();
    const signResponse = await signResponsePromise;
    expect(
      signResponse.status(),
      `receipts-sign doit répondre 2xx (reçu ${signResponse.status()})`,
    ).toBeLessThan(400);

    // Résultat métier : la quittance passe à "signed" côté dashboard bailleur
    // (l'UI recharge après signature). On ne se fie pas au toast seul.
    await expect(page.getByText('Quittance signée').first()).toBeVisible({ timeout: 10_000 });

    // 7. Reconnexion locataire : LA quittance créée pendant CE parcours
    // (période du mois courant) doit être signée. La quittance seed
    // (période 2026-07, signée par avance) ne compte pas comme preuve.
    const periodStart = new Date();
    periodStart.setDate(1);
    const currentPeriod = periodStart.toISOString().slice(0, 10); // ex: 2026-09-01
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Email').fill(TENANT_EMAIL);
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill(TENANT_PW);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Mes quittances' })).toBeVisible();
    const newReceiptRow = page.locator('li', { hasText: currentPeriod }).filter({
      hasText: 'signée',
    });
    await expect(newReceiptRow.first()).toBeVisible({ timeout: 15_000 });
  });

  test('recherche géolocalisée : bascule carte/liste et carte affichée', async ({ page }) => {
    await page.goto('/explorer');
    await page.getByRole('tab', { name: 'Carte' }).click();
    await expect(page.getByTestId('map')).toBeVisible();
    await expect(page.getByTestId('map')).toContainText('OpenStreetMap', { timeout: 10_000 });
  });
});
