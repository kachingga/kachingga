import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// Email + password or Google with Supabase Auth (decision in CLAUDE.md). Screens call these; errors
// come back as Supabase AuthError (show `error.message`, translated when needed).
export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });
export const signUp = (email: string, password: string) =>
  supabase.auth.signUp({ email, password });
// Leaves the app for Google and comes back to `/` (→ /grupos) with the session. The redirect URL
// has to be allowed in Supabase (INFRA.md → "Supabase").
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  });
export const signOut = () => supabase.auth.signOut();

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
