// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Project conventions enforced by lint (see apps/mobile/CLAUDE.md → "Cómo usar la API desde la app").
const apiRuntimeImport = {
  name: '@kachingga/api',
  allowTypeImports: true,
  message: 'De la API solo se importan tipos (`import type`). Para validaciones usá `@kachingga/api/schemas`.',
};
const apiDeepImport = {
  group: ['@kachingga/api/*', '!@kachingga/api/schemas'],
  allowTypeImports: true,
  message: 'De la API solo se importan tipos o `@kachingga/api/schemas`.',
};
const supabaseImport = {
  name: '@supabase/supabase-js',
  message: 'Supabase se usa solo para auth y solo desde src/lib/supabase.ts. Los datos van por tRPC.',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [apiRuntimeImport, supabaseImport], patterns: [apiDeepImport] },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'No hacer fetch a mano: la data va por tRPC (useTRPC + TanStack Query).' },
      ],
    },
  },
  {
    // The only place allowed to talk to Supabase (auth/session).
    files: ['src/lib/supabase.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { paths: [apiRuntimeImport], patterns: [apiDeepImport] }],
    },
  },
]);
