import { Navigate, Outlet, useLocation } from 'react-router';

import { useSession } from '@/lib/auth';
import { cachedUser, useOnline } from '@/lib/offline-cache';
import { withReturnTo } from '@/lib/return-to';

/**
 * Route guard: renders the child routes only with a session; otherwise redirects to /login
 * (with `?volver=` the page it was opening, see `src/lib/return-to.ts`).
 * While the session is being restored from storage, shows a skeleton to avoid a flash of /login.
 * Offline with an expired token Supabase can't refresh the session: if this device has the last
 * user's saved cache, the app opens read-only with it (back online, the session refreshes or it's /login).
 */
export function RequireAuth() {
  const session = useSession();
  const online = useOnline();
  const location = useLocation();

  if (session === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 150}ms` }}
              className="h-2.5 w-2.5 animate-bounce rounded-full bg-muted-foreground"
            />
          ))}
        </div>
      </div>
    );
  }

  // Remembers where it was going (e.g. an invite link) to come back after logging in.
  if (!session && !(!online && cachedUser()))
    return <Navigate to={withReturnTo('/login', location.pathname + location.search)} replace />;
  return <Outlet />;
}
