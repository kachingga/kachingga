/// <reference lib="dom" />
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';

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

// The installed app opened offline after a while: the token expired and Supabase retries refreshing
// it for ~25 s. With the last user's cache on the device, the read-only mode doesn't wait for that.
test('sin conexión y con la sesión vencida abre enseguida en solo lectura', async ({
  page,
  context,
}) => {
  // Where the library keeps the session (src/lib/supabase.ts), for the Supabase of this build.
  const { VITE_SUPABASE_URL } = loadEnv('production', resolve(import.meta.dirname, '..'), 'VITE_');
  const sessionKey = `sb-${new URL(VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  // A made-up session: it never reaches Supabase.
  await context.route(/\/auth\/v1\//, (route) => route.abort('internetdisconnected'));

  await page.goto('/login');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.evaluate((key) => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(
      key,
      JSON.stringify({
        access_token: 'vencido',
        refresh_token: 'vencido',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now - 600,
        user: { id: 'e2e-offline' },
      }),
    );
    localStorage.setItem('kachingga-cache-user', 'e2e-offline');
  }, sessionKey);

  await context.setOffline(true);
  await page.goto('/grupos');

  // Before, the screen stayed empty until the library gave up (~25 s).
  await expect(page.getByRole('heading', { name: 'Mis grupos' })).toBeVisible({ timeout: 2_000 });
  await expect(page.getByText('Sin conexión: mostrando lo último que viste')).toBeVisible();
});
