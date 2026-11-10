import { Navigate, Outlet, useLocation } from 'react-router';

import { Splash } from '@/components/splash';
import { useSession } from '@/lib/auth';
import { cachedUser, useOnline } from '@/lib/offline-cache';
import { withReturnTo } from '@/lib/return-to';

/**
 * Route guard: renders the child routes only with a session; otherwise redirects to /login
 * (with `?volver=` the page it was opening, see `src/lib/return-to.ts`).
 * While the session is being restored from storage, shows the splash (the logo) to avoid a flash of /login.
 * Offline with an expired token Supabase can't refresh the session: if this device has the last
 * user's saved cache, the app opens read-only with it (back online, the session refreshes or it's /login).
 */
export function RequireAuth() {
  const session = useSession();
  const online = useOnline();
  const location = useLocation();

  if (session === undefined) return <Splash />;

  // Remembers where it was going (e.g. an invite link) to come back after logging in.
  if (!session && !(!online && cachedUser()))
    return <Navigate to={withReturnTo('/login', location.pathname + location.search)} replace />;
  return <Outlet />;
}
