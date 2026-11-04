import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Where the local API runs (`bun run api`).
const API_URL = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
