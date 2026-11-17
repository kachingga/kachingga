import { expect, test } from '@playwright/test';

// The narrowest phone we support: 320 px (an iPhone SE with "Zoom de pantalla"). Nothing of the
// screens without login goes past the right edge (before #169 the captcha, at least 300 px wide
// when flexible, pushed the form out) and no control takes the taps of another (#173). The screens
// with login are checked by hand (docs/claude/web/ui-ux.md).
test.use({ viewport: { width: 320, height: 568 } });

for (const [name, path] of [
  ['login', '/login'],
  ['registro', '/registro'],
  ['recuperar contraseña', '/recuperar-contrasena'],
]) {
  test(`${name} entra en 320 px y cada toque cae donde corresponde`, async ({ page }) => {
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

    // Each control's own box takes its taps: the invisible 44 px area of a neighbor (`tap-area`,
    // #173) never covers it. Points 2 px in from its edges and in its center.
    const stolen = await page.evaluate(() => {
      const found: string[] = [];
      const controls = document.querySelectorAll<HTMLElement>(
        'main a[href], main button, main input',
      );
      for (const el of controls) {
        if (el.getClientRects().length !== 1) continue; // a link that wraps inside a sentence
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
        for (const [x, y] of [
          [cx, cy],
          [cx, r.top + 2],
          [cx, r.bottom - 2],
          [r.left + 2, cy],
          [r.right - 2, cy],
        ] as const) {
          const hit = document.elementFromPoint(x, y);
          const owner = hit?.closest('a[href], button, input, iframe');
          if (owner && !el.contains(hit) && owner !== el) {
            found.push(`${el.outerHTML.slice(0, 60)} ← ${owner.outerHTML.slice(0, 60)}`);
            break;
          }
        }
      }
      return found;
    });
    expect(stolen).toEqual([]);
  });
}
