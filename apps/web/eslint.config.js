import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Project conventions enforced by lint (see apps/web/CLAUDE.md → "Cómo usar la API").
const apiRuntimeImport = {
  name: '@kachingga/api',
  allowTypeImports: true,
  message:
    'De la API solo se importan tipos (`import type`). Para validaciones usá `@kachingga/api/schemas`.',
};
const apiDeepImport = {
  group: ['@kachingga/api/*', '!@kachingga/api/schemas'],
  allowTypeImports: true,
  message: 'De la API solo se importan tipos o `@kachingga/api/schemas`.',
};
const supabaseImport = {
  name: '@supabase/supabase-js',
  allowTypeImports: true,
  message:
    'Supabase se usa solo para auth y solo desde src/lib/supabase.ts. Los datos van por tRPC.',
};

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [apiRuntimeImport, supabaseImport], patterns: [apiDeepImport] },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'No hacer fetch a mano: la data va por tRPC (useTRPC + TanStack Query).',
        },
      ],
    },
  },
  {
    // The only place allowed to talk to Supabase (auth/session).
    files: ['src/lib/supabase.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: [apiRuntimeImport], patterns: [apiDeepImport] },
      ],
    },
  },
  {
    // shadcn/ui components are generated (`bunx shadcn add`) and export their variants next to
    // the component; that only affects hot reload of those files.
    files: ['src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
