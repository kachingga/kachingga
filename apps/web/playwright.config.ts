import { defineConfig, devices } from '@playwright/test';

// E2E against the production build served locally. Mobile-first: the main project is a phone.
// With E2E_API=1 it also starts the API (dev database and Supabase, from apps/api/.env or the
// environment) and runs the critical flows (e2e/recorridos.spec.ts). Details: docs/claude/web/testing.md.
const withApi = !!process.env.E2E_API;

const web = {
  command: 'bun run build && bun run preview --port 4173 --strictPort',
  url: 'http://localhost:4173',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};

// `preview` forwards /trpc to the API on :3000 (vite.config.ts), so the web runs with VITE_API_URL empty.
const api = {
  command: 'bun run --cwd ../api start',
  url: 'http://localhost:3000/health',
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173', locale: 'es-AR', trace: 'retain-on-failure' },
  projects: [
    { name: 'celular', use: { ...devices['iPhone 15'] } },
    // The flows with data run only on the phone: they're slow and create data in dev.
    { name: 'compu', use: { ...devices['Desktop Chrome'] }, testIgnore: /recorridos/ },
  ],
  webServer: withApi ? [api, web] : web,
});
