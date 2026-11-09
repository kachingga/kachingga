/// <reference lib="dom" />
import { expect, test } from '@playwright/test';

// Without connection the app still opens (service worker) and says it's showing the last data.
// The saved data itself (TanStack Query cache) is covered by unit tests: here there's no API.
test('sin conexión abre igual y avisa', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The service worker takes control on the next load; then it serves the app offline.
  await page.reload();

  await context.setOffline(true);
  await page.reload();

  await expect(page).toHaveTitle('Kachingga');
  await expect(page.getByRole('status')).toHaveText('Sin conexión: mostrando lo último que viste');

  await context.setOffline(false);
  await expect(page.getByRole('status')).toHaveCount(0);
});
