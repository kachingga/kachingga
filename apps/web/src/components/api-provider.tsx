import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useState, type ReactNode } from 'react';

import { createApiClient, TRPCProvider } from '@/lib/trpc';

function isUnauthorized(error: unknown) {
  return error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED';
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Retry once on UNAUTHORIZED to recover from the race condition right after login
            // (token may not be ready when the first request fires). After 1 retry, stop.
            // Genuine session expiry: Supabase fires onAuthStateChange → RequireAuth redirects.
            retry: (count, error) => (isUnauthorized(error) ? count < 1 : count < 3),
          },
        },
      }),
  );
  const [trpcClient] = useState(createApiClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
