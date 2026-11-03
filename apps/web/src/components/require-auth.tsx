import { Navigate, Outlet } from 'react-router';

import { useSession } from '@/lib/auth';

/**
 * Route guard: renders the child routes only with a session; otherwise redirects to /login.
 * While the session is being restored from storage, shows a skeleton to avoid a flash of /login.
 */
export function RequireAuth() {
  const session = useSession();

  if (session === undefined) {
    return (
      <div className="flex min-h-dvh flex-col bg-black">
        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-32 pt-14">
          <div className="mb-6 h-9 w-28 animate-pulse rounded-xl bg-neutral-800" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-800" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
