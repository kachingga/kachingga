import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { useState, type ReactNode } from 'react';

import { signOut } from '@/lib/auth';
import { createApiClient, TRPCProvider } from '@/lib/trpc';

function isUnauthorized(error: unknown) {
  return error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED';
}

function handleUnauthorized(error: unknown) {
  if (isUnauthorized(error)) {
    void signOut().then(() => {
      window.location.replace('/login');
    });
  }
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleUnauthorized }),
        mutationCache: new MutationCache({ onError: handleUnauthorized }),
        defaultOptions: {
          queries: {
            retry: (count, error) => !isUnauthorized(error) && count < 3,
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
