/// <reference lib="dom" />
import { expect, test } from '@playwright/test';

// Installable app: valid manifest + a service worker that takes control (it caches only the app's files).
test('la app es instalable', async ({ page, request }) => {
  await page.goto('/');

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: 'Kachingga', display: 'standalone', start_url: '/' });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512' }),
      expect.objectContaining({ purpose: 'maskable' }),
    ]),
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

  const swActive = await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active);
  expect(swActive).toBe(true);
});
