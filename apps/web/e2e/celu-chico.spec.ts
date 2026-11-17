import { expect, test } from '@playwright/test';

// The narrowest phone we support: 320 px (an iPhone SE with "Zoom de pantalla"). Nothing of the
// screens without login goes past the right edge; before #169 the captcha (at least 300 px wide
// when flexible) pushed the form out. The screens with login are checked by hand (docs/claude/web/ui-ux.md).
test.use({ viewport: { width: 320, height: 568 } });

for (const [name, path] of [
  ['login', '/login'],
  ['registro', '/registro'],
  ['recuperar contraseña', '/recuperar-contrasena'],
]) {
  test(`${name} entra en 320 px`, async ({ page }) => {
    await page.goto(path);
    const submit = page.locator('form button[type=submit]').first();
    // With the captcha on, the button is enabled once it gives a token (the widget is there by then).
    await expect(submit).toBeEnabled({ timeout: 15_000 });
    const tooWide = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5)
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(tooWide).toEqual([]);
  });
}
