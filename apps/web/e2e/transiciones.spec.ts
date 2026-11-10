import { expect, test, type Page } from '@playwright/test';

// Screen transitions with the View Transitions API (src/lib/screen-transitions.ts): Chrome and
// WebKit have it. Login ↔ register, no data needed.

type Spy = { transitions: number; animated: number[] };

test.beforeEach(async ({ page }) => {
  // Count the transitions the app starts and, when each one starts animating, how many
  // animations the browser runs on the screens' pictures.
  await page.addInitScript(() => {
    const spy: Spy = { transitions: 0, animated: [] };
    (window as Window & { spy?: Spy }).spy = spy;
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((arg: never) => {
      spy.transitions += 1;
      const transition = start(arg);
      void transition.ready.then(() =>
        spy.animated.push(
          document
            .getAnimations()
            .filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.includes('(page)'))
            .length,
        ),
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
});

const state = (page: Page) =>
  page.evaluate(() => ({
    ...(window as Window & { spy?: Spy }).spy,
    nav: document.documentElement.dataset.nav,
  }));

test('las pantallas cambian con View Transitions: hacia adelante y hacia atrás', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Qué bueno verte' })).toBeVisible();
  expect(await state(page)).toMatchObject({ transitions: 0, nav: 'none' });

  await page.getByRole('link', { name: 'Creá tu cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Creá tu cuenta' })).toBeVisible();
  await expect.poll(() => state(page)).toMatchObject({ transitions: 1, nav: 'forward' });

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Qué bueno verte' })).toBeVisible();
  await expect.poll(() => state(page)).toMatchObject({ transitions: 2, nav: 'back' });
  // Both screens moved (old and new picture, + their group) in each transition.
  expect((await state(page)).animated?.every((n) => n >= 2)).toBe(true);
});

test('con "reducir movimiento" no se anima nada', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await page.getByRole('link', { name: 'Creá tu cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Creá tu cuenta' })).toBeVisible();
  await expect.poll(async () => (await state(page)).animated).toEqual([0]);
});
