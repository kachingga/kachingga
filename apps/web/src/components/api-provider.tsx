import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { TRPCClientError } from '@trpc/client';
import { useEffect, useState, type ReactNode } from 'react';

import { useSession } from '@/lib/auth';
import {
  CACHE_MAX_AGE,
  cachedUser,
  createMutationCache,
  createPersister,
  rememberCachedUser,
} from '@/lib/offline-cache';
import { createApiClient, TRPCProvider } from '@/lib/trpc';

function isUnauthorized(error: unknown) {
  return error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED';
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (userId) rememberCachedUser(userId);
  }, [userId]);

  // Wait until the session is restored, so the cache that loads is the right user's.
  if (session === undefined) return null;

  // Without a session it's still the last user's cache: offline with an expired token the session
  // can't be refreshed, and RequireAuth lets that user read what was saved (sign out deletes it).
  const owner = userId ?? cachedUser();
  // One QueryClient per user (key): another account never sees what's in memory from the previous one.
  return (
    <CachedApiProvider key={owner ?? 'anon'} userId={owner}>
      {children}
    </CachedApiProvider>
  );
}

/** TanStack Query + tRPC, with the cache saved on the device for `userId` (none if null). */
export function CachedApiProvider({
  userId,
  children,
  trpcClient: client,
  persistThrottle,
}: {
  userId: string | null;
  children: ReactNode;
  trpcClient?: ReturnType<typeof createApiClient>;
  persistThrottle?: number;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: createMutationCache(),
        defaultOptions: {
          queries: {
            // Kept in memory as long as the saved copy is valid (otherwise it isn't saved).
            gcTime: CACHE_MAX_AGE,
            // Retry once on UNAUTHORIZED to recover from the race condition right after login
            // (token may not be ready when the first request fires). After 1 retry, stop.
            // Genuine session expiry: Supabase fires onAuthStateChange → RequireAuth redirects.
            retry: (count, error) => (isUnauthorized(error) ? count < 1 : count < 3),
          },
        },
      }),
  );
  const [trpcClient] = useState(() => client ?? createApiClient());
  const [persister] = useState(() =>
    userId ? createPersister(userId, persistThrottle) : undefined,
  );

  const content = (
    <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
      {children}
    </TRPCProvider>
  );

  // Logged out: nothing is saved or restored.
  if (!persister) return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        // Only successful queries (the default); never mutations.
        dehydrateOptions: { shouldDehydrateMutation: () => false },
      }}
    >
      {content}
    </PersistQueryClientProvider>
  );
}
