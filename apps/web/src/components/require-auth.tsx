import { Navigate, Outlet, useLocation } from 'react-router';

import { Splash } from '@/components/splash';
import { useSession } from '@/lib/auth';
import { useOfflineReadOnly } from '@/lib/offline-cache';
import { withReturnTo } from '@/lib/return-to';

/**
 * Route guard: renders the child routes only with a session; otherwise redirects to /login
 * (with `?volver=` the page it was opening, see `src/lib/return-to.ts`).
 * While the session is being restored from storage, shows the splash (the logo) to avoid a flash of /login.
 * Offline with the last user's saved cache, the app opens read-only with it right away, without
 * waiting for the session: with an expired token Supabase can't refresh it (back online, the
 * session refreshes or it's /login).
 */
export function RequireAuth() {
  const session = useSession();
  const offlineReadOnly = useOfflineReadOnly();
  const location = useLocation();

  if (session === undefined && !offlineReadOnly) return <Splash />;

  if (!session && !offlineReadOnly) {
    // Google came back to `/` with an error instead of the session (e.g. sign-ups closed in
    // Supabase): the login says why. Where it was going stays saved for Google (return-to.ts).
    const googleError = location.pathname === '/' && oauthErrorCode(location.search);
    if (googleError)
      return <Navigate to={`/login?google=${encodeURIComponent(googleError)}`} replace />;
    // Remembers where it was going (e.g. an invite link) to come back after logging in.
    return <Navigate to={withReturnTo('/login', location.pathname + location.search)} replace />;
  }
  return <Outlet />;
}

/** Supabase sends an OAuth error back in the query: `error_code` (e.g. `signup_disabled`) and `error`. */
function oauthErrorCode(search: string) {
  const params = new URLSearchParams(search);
  return params.get('error_code') ?? params.get('error');
}
