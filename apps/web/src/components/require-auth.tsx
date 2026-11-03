import { Navigate, Outlet } from 'react-router';

import { useSession } from '@/lib/auth';

/**
 * Route guard: renders the child routes only with a session; otherwise redirects to /login.
 * Use it as the `element` of a parent route in src/router.tsx once the login screen exists.
 */
export function RequireAuth() {
  const session = useSession();
  if (session === undefined) return null; // restoring the session: render nothing (no flash of /login)
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
