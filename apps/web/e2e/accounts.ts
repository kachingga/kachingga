import { existsSync } from 'node:fs';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Accounts of the flows with the API (recorridos.spec.ts), through the admin API of the dev Supabase
// (staging-kachingga): it skips "Confirm email" and the captcha. Same SUPABASE_URL and
// SUPABASE_SECRET_KEY as the API the E2E start: from the environment (e2e.yml) or, locally, from
// apps/api/.env (the environment wins). Test side only (Node): the secret key never reaches the
// browser. docs/claude/web/testing.md → "E2E".

export type Account = { email: string; password: string };

const apiEnvFile = new URL('../../api/.env', import.meta.url);
let client: SupabaseClient | undefined;

function admin() {
  if (!client) {
    if (existsSync(apiEnvFile)) process.loadEnvFile(apiEnvFile);
    const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey } = process.env;
    if (!url || !secretKey)
      throw new Error(
        'Faltan SUPABASE_URL y SUPABASE_SECRET_KEY (apps/api/.env o el entorno): ver testing.md',
      );
    client = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client.auth.admin;
}

/** A new account with its email already confirmed: it logs in from the login screen. */
export async function createConfirmedAccount({ email, password }: Account) {
  const { error } = await admin().createUser({ email, password, email_confirm: true });
  if (error) throw error;
}

/**
 * For an account registered from the screen and not confirmed yet: the token its confirmation mail
 * carries (`{{ .TokenHash }}`, INFRA.md → "Supabase"). It's a new one: it replaces the mailed one.
 */
export async function confirmationTokenHash({ email, password }: Account) {
  const { data, error } = await admin().generateLink({ type: 'signup', email, password });
  if (error) throw error;
  return data.properties.hashed_token;
}
