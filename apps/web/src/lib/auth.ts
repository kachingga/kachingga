import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { withReturnTo } from '@/lib/return-to';
import { supabase } from '@/lib/supabase';

// Email + password or Google with Supabase Auth (decision in CLAUDE.md). Screens call these; errors
// come back as Supabase AuthError (show them with `authErrorMessage`, src/lib/auth-errors.ts).
// `captchaToken`: the Turnstile token (src/lib/use-captcha.tsx), undefined when captcha is off.
// Confirming the email and recovering the password: docs/claude/web/usar-la-api.md → "Login".
export const signIn = (email: string, password: string, captchaToken?: string) =>
  supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
/** With "Confirm email" on in Supabase, it returns a user without a session and sends the mail. */
export const signUp = (
  email: string,
  password: string,
  { returnTo, captchaToken }: { returnTo: string; captchaToken?: string },
) =>
  supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: confirmEmailRedirect(returnTo), captchaToken },
  });
// Leaves the app for Google and comes back to `/` (→ /grupos) with the session. The redirect URL
// has to be allowed in Supabase (INFRA.md → "Supabase").
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  });
export const signOut = () => supabase.auth.signOut();

// The confirmation mail's link goes to the login, which confirms the email with the token the mail
// adds (`#token_hash=…`) and goes on to `returnTo` (e.g. an invite link).
function confirmEmailRedirect(returnTo: string) {
  return `${window.location.origin}${withReturnTo('/login', returnTo)}`;
}

export const resendConfirmation = (
  email: string,
  { returnTo, captchaToken }: { returnTo: string; captchaToken?: string },
) =>
  supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: confirmEmailRedirect(returnTo), captchaToken },
  });

/** The token of the confirmation mail's link: confirms the email and logs in. */
export const confirmEmail = (tokenHash: string) =>
  supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });

/** Sends the mail to pick a new password (Supabase doesn't tell whether the account exists). */
export const requestPasswordReset = (email: string, captchaToken?: string) =>
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/nueva-contrasena`,
    captchaToken,
  });

/** The token of the password-reset mail's link: logs in to pick the new password. */
export const verifyPasswordReset = (tokenHash: string) =>
  supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });

export const updatePassword = (password: string) => supabase.auth.updateUser({ password });

/** Current session. `undefined` while it's being restored from storage, `null` when logged out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/** Access token for the API (Supabase refreshes it when needed). */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
