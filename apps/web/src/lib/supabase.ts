import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;

// Where the library saves the session on this device (localStorage). It's the library's default
// key (so sessions saved before keep working), set explicitly so `signOutOfDevice` can remove it.
const SESSION_KEY = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;

// The only file allowed to import Supabase (enforced by ESLint). Supabase is for auth only:
// data always goes through the API (tRPC).
export const supabase = createClient(
  url,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  // Session persisted in localStorage and refreshed automatically by the library. PKCE for OAuth
  // (Google): the redirect back carries a one-time code, not the tokens; the library exchanges it on load.
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      storageKey: SESSION_KEY,
    },
  },
);

/**
 * Signs out and always leaves this device without the session. Online, Supabase revokes it and the
 * library deletes it. Without connection (e.g. the installed app opened offline, with the token
 * expired) the library returns an error and keeps it in localStorage, so whoever opens the app next
 * would be in that account: then it's deleted here anyway. The refresh token stays valid on Supabase
 * until it expires, but it's no longer on the device.
 */
export async function signOutOfDevice() {
  // Only "offline" is trusted (`onLine === true` can be wrong): then don't even try, because the
  // library retries refreshing an expired token for ~25 s before giving up.
  if (navigator.onLine) {
    const { error } = await supabase.auth.signOut();
    if (!error) return;
  }
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: nothing was saved either.
  }
  // With nothing saved, the library signs out without asking Supabase: it deletes the rest of its
  // keys and fires SIGNED_OUT (useSession, the offline cache). But first it waits until it finished
  // starting, and offline, right after opening the app with the token expired, that's when it gives
  // up refreshing it (~25 s): then don't wait, the session is no longer on the device.
  const signedOut = supabase.auth.signOut({ scope: 'local' });
  if (navigator.onLine) await signedOut;
}
