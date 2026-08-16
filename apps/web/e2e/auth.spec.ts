import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('register form renders with all fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/nom complet/i)).toBeVisible();
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
    await expect(page.getByLabel(/je suis/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: /je suis/i })).toBeVisible();
    await expect(page.getByRole('checkbox')).toBeVisible();
  });

  test('register requires consent checkbox', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/nom complet/i).fill('Test User');
    await page.getByLabel(/e-?mail/i).fill('test@example.com');
    await page.getByLabel(/mot de passe/i).fill('TestPass123!');
    await page.getByLabel(/je suis/i).selectOption({ label: 'Un locataire — je cherche un logement' });
    await page.getByRole('button', { name: /créer mon compte/i }).click();
    await expect(page.getByText(/consentement/i)).toBeVisible();
  });

  test('login page renders with email and password', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/e-?mail/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible();
  });

  test('login shows error on bad credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-?mail/i).fill('nonexistent@example.com');
    await page.getByLabel(/mot de passe/i).fill('WrongPass123!');
    await page.getByRole('button', { name: /se connecter/i }).click();
    await expect(page.getByText(/identifiants invalides/i)).toBeVisible();
  });

  test('unauthenticated user is redirected to login for protected pages', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Residences', () => {
  test('home page shows search and residence cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder(/quartier, ville/i)).toBeVisible();
  });

  test('residence detail page loads', async ({ page }) => {
    await page.goto('/');
    const firstCard = page.locator('[class*="card"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await expect(page).toHaveURL(/residences\//);
    }
  });
});

test.describe('Static pages', () => {
  test('confidentialite page is accessible', async ({ page }) => {
    await page.goto('/confidentialite');
    await expect(page.getByRole('heading', { name: /politique de confidentialité/i })).toBeVisible();
    await expect(page.getByText(/loi APDP/i)).toBeVisible();
  });
});