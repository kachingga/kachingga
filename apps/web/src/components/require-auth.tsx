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

  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
