import { expect, test } from '@playwright/test';

import { expectAccessible } from './axe.ts';

// Accessibility of the screens without data (the ones with data are checked in recorridos.spec.ts,
// with the API). In light and dark: contrast changes.
for (const colorScheme of ['light', 'dark'] as const) {
  test(`login y registro accesibles (${colorScheme === 'light' ? 'claro' : 'oscuro'})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Qué bueno verte' })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole('link', { name: 'Creá tu cuenta' }).click();
    await expect(page.getByRole('heading', { name: 'Creá tu cuenta' })).toBeVisible();
    await expectAccessible(page);
  });
}
