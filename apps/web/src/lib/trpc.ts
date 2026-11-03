import type { AppRouter } from '@kachingga/api';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import superjson from 'superjson';

import { getAccessToken } from '@/lib/auth';

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function createApiClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${import.meta.env.VITE_API_URL}/trpc`,
        transformer: superjson,
        // Supabase session token on every request; without it, everything but health.ping is UNAUTHORIZED.
        async headers() {
          const token = await getAccessToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
