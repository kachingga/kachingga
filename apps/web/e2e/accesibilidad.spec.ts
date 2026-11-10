import { expect, test } from '@playwright/test';

import { expectAccessible } from './axe.ts';

// Accessibility of the screens without data (the ones with data are checked in recorridos.spec.ts,
// with the API). In light and dark: contrast changes. With the captcha on (e2e.yml: Cloudflare's test
// key), each form's button is enabled once the widget has its token: waiting for it, axe always
// checks the screen with the widget already there.
for (const colorScheme of ['light', 'dark'] as const) {
  test(`login, registro y recuperar la contraseña accesibles (${colorScheme === 'light' ? 'claro' : 'oscuro'})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Qué bueno verte' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dale, entremos' })).toBeEnabled();
    await expectAccessible(page);

    await page.getByRole('link', { name: 'Creá tu cuenta' }).click();
    await expect(page.getByRole('heading', { name: 'Creá tu cuenta' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
    await expectAccessible(page);

    await page.goto('/login');
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page.getByRole('heading', { name: '¿Olvidaste tu contraseña?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mandame el link' })).toBeEnabled();
    await expectAccessible(page);
  });
}
