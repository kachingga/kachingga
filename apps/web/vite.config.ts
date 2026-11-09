import { sentryVitePlugin } from '@sentry/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Where the local API runs (`bun run api`).
const API_URL = 'http://localhost:3000';

// Commit being built: Railway exposes it during the build. Sentry groups errors by it (release).
const release = process.env.RAILWAY_GIT_COMMIT_SHA ?? '';
// Source maps for readable stack traces in Sentry: only when deploying with SENTRY_AUTH_TOKEN
// (plus SENTRY_ORG and SENTRY_PROJECT). They're uploaded and deleted from dist/, never served.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && release);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app + service worker that caches the app's own files (never API data).
    // autoUpdate: a new deploy replaces the old version on the next open.
    VitePWA({
      registerType: 'autoUpdate',
      pwaAssets: { config: true, overrideManifestIcons: true, injectThemeColor: false },
      manifest: {
        name: 'Kachingga',
        short_name: 'Kachingga',
        description: 'Dividí gastos con tu grupo',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FAF6EE',
        theme_color: '#0C5C3C',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
    uploadSourceMaps &&
      sentryVitePlugin({
        release: { name: release },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      }),
  ],
  define: { __APP_RELEASE__: JSON.stringify(release) },
  build: { sourcemap: uploadSourceMaps ? 'hidden' : false },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Local: the web calls /trpc on its own origin and Vite forwards it to the API, so there's no
  // CORS and it works from a phone on the same Wi-Fi (`bun run dev:celu` exposes it on the LAN).
  server: {
    port: 5173,
    host: process.env.KACHINGGA_LAN ? true : 'localhost',
    proxy: { '/trpc': API_URL },
  },
  preview: { proxy: { '/trpc': API_URL } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Fixed values so tests never depend on a local .env (they run in CI and in everyone's pre-commit)
    env: {
      VITE_API_URL: 'http://localhost:3000',
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
    include: ['src/**/*.test.{ts,tsx}', 'server.test.ts'],
  },
});
