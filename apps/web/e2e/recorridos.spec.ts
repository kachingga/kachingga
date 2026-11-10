import { type Browser, expect, type Page, test } from '@playwright/test';

import { type Account, confirmationTokenHash, createConfirmedAccount } from './accounts.ts';
import { expectAccessible } from './axe.ts';

// Critical flows against the real API and the dev Supabase and database (stg). Only with
// E2E_API=1 (it starts the API too: playwright.config.ts). Every run makes new accounts with unique
// emails and leaves its data in dev, named "E2E …" (the group gets archived at the end).
// With "Confirm email" and the captcha (Turnstile test keys) on or off: docs/claude/web/testing.md.
test.skip(!process.env.E2E_API, 'Sin E2E_API: estos recorridos necesitan la API (ver testing.md)');
test.describe.configure({ timeout: 120_000 });

const run = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
const password = `E2e-${run}-pass`;

/** Made with the admin API, already confirmed: no mail goes to example.com. */
function newAccount(name: string): Account {
  return { email: `e2e+${name}-${run}@example.com`, password };
}

// With the captcha on, submit buttons stay disabled until the widget has its token: `click()` waits.
async function logIn(page: Page, account: Account) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Dale, entremos' }).click();
  await expect(page).toHaveURL(/\/grupos$/);
}

async function newUserPage(browser: Browser, name: string) {
  // Same device and baseURL as the project, in its own context (its own session).
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, locale, baseURL } =
    test.info().project.use;
  const context = await browser.newContext({
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
    locale,
    baseURL,
  });
  const page = await context.newPage();
  const account = newAccount(name);
  await createConfirmedAccount(account);
  await logIn(page, account);
  return page;
}

test('registro (confirmando el email), cerrar sesión y volver a entrar', async ({ page }) => {
  // The only account made from the register screen. With "Confirm email" on, Supabase mails it, and
  // it won't mail example.com: a Resend test address, which counts as delivered (no bounce).
  const account = { email: `delivered+e2e-registro-${run}@resend.dev`, password };
  await page.goto('/registro');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await page.getByLabel('Confirmar contraseña').fill(account.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  // "Confirm email" off: straight in. On: "Revisá tu mail", and the mail's link (a token made with
  // the admin API, as in the template) confirms the email and logs in from the login screen.
  const mailSent = page.getByRole('heading', { name: 'Revisá tu mail' });
  const groups = page.getByRole('heading', { name: 'Mis grupos' });
  await expect(mailSent.or(groups)).toBeVisible();
  if (await mailSent.isVisible())
    await page.goto(`/login#token_hash=${await confirmationTokenHash(account)}`);
  await expect(groups).toBeVisible();
  await expect(page).toHaveURL(/\/grupos$/);

  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await logIn(page, account);
});

test('grupo: gasto, saldos, unirse con código y saldar', async ({ browser }) => {
  const galo = await newUserPage(browser, 'galo');
  const groupName = `E2E ${run}`;
  let inviteCode = '';

  await test.step('crear grupo', async () => {
    await galo.getByRole('link', { name: 'Crear grupo' }).first().click();
    await galo.getByLabel('Nombre del grupo').fill(groupName);
    await galo.getByLabel('¿Cómo te llamás en este grupo?').fill('Galo');
    await galo.getByRole('button', { name: 'Crear grupo' }).click();
    await expect(galo.getByRole('heading', { name: 'Grupo creado' })).toBeVisible();
    inviteCode = (await galo.getByText(/^[A-Z0-9]{8}$/).textContent())!;
    await galo.getByRole('button', { name: 'Ir al grupo' }).click();
    await expect(galo.getByText(groupName)).toBeVisible();
  });

  await test.step('agregar participante sin cuenta', async () => {
    await galo.getByRole('button', { name: 'Opciones del grupo' }).click();
    await galo.getByRole('link', { name: 'Participantes' }).click();
    await galo.getByLabel('Nombre de la persona sin cuenta').fill('Naiara');
    await galo.getByRole('button', { name: 'Agregar persona' }).click();
    await expect(galo.getByRole('listitem').filter({ hasText: 'Naiara' })).toContainText(
      'sin cuenta',
    );
    await galo.getByRole('button', { name: 'Volver' }).click();
  });

  await test.step('agregar gasto en partes iguales y ver saldos', async () => {
    await galo.getByRole('link', { name: 'Agregar gasto' }).click();
    await galo.getByLabel('Monto').fill('1000');
    await galo.getByLabel('Descripción').fill('E2E cena');
    await galo.getByRole('button', { name: 'Agregar gasto' }).click();
    await expect(galo.getByText('E2E cena')).toBeVisible();
    await expect(galo.getByRole('region', { name: 'Tu situación' })).toContainText(
      /Te deben\s*\$\s?500/,
    );
    await expect(galo.getByText(/Naiara → Galo/)).toContainText('500');
    // The main screen with data, accessible (axe): "Tu situación", balances, transfers, expenses.
    await expectAccessible(galo);
  });

  const naiara = await newUserPage(browser, 'naiara');

  await test.step('unirse con código reclamando a Naiara', async () => {
    await naiara.getByRole('link', { name: 'Unirme con código' }).first().click();
    await naiara.getByLabel('Código de invitación').fill(inviteCode);
    await naiara.getByRole('button', { name: 'Buscar grupo' }).click();
    await naiara.getByLabel('Soy Naiara').check();
    await naiara.getByRole('button', { name: 'Unirme', exact: true }).click();
    await expect(naiara.getByText(groupName)).toBeVisible();
    await expect(naiara.getByRole('region', { name: 'Tu situación' })).toContainText(
      /Debés\s*\$\s?500/,
    );
  });

  await test.step('marcar como pagado y quedar al día', async () => {
    await naiara.getByRole('button', { name: 'Marcar como pagado' }).click();
    await naiara.getByRole('button', { name: 'Registrar' }).click();
    await naiara.getByRole('button', { name: 'Volver' }).click();
    await expect(naiara.getByText('Estás al día')).toBeVisible();

    await galo.reload();
    await expect(galo.getByText('Estás al día')).toBeVisible();
  });

  await test.step('archivar el grupo de prueba', async () => {
    await galo.getByRole('button', { name: 'Opciones del grupo' }).click();
    await galo.getByRole('button', { name: 'Archivar grupo' }).click();
    await galo.getByRole('button', { name: 'Archivar', exact: true }).click();
    await expect(galo.getByText(/archivado/i).first()).toBeVisible();
  });

  await galo.context().close();
  await naiara.context().close();
});
