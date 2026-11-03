import { expect, test } from '@playwright/test';

// Smoke: the app builds, loads and renders. Add one spec per critical flow (see apps/web/CLAUDE.md → "Testing").
test('la app carga', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Kachingga');
  await expect(page.getByRole('heading', { name: 'Kachingga' })).toBeVisible();
});
