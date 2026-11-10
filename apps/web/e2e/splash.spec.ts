import { expect, test } from '@playwright/test';

// While the JS downloads and starts, index.html shows the logo (no blank screen), and React
// replaces it when it mounts.
test('mientras carga se ve el logo, y después la app', async ({ page }) => {
  // Hold the app's JS until the splash was checked.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/assets/*.js', async (route) => {
    await held;
    await route.continue();
  });

  await page.goto('/login', { waitUntil: 'commit' });
  const splash = page.getByRole('status', { name: 'Cargando' });
  await expect(splash).toBeVisible();
  await expect(splash.locator('svg')).toBeVisible();

  release();
  await expect(page.getByRole('heading', { name: 'Qué bueno verte' })).toBeVisible();
  await expect(splash).toHaveCount(0);
});
