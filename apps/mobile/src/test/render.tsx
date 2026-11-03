import type { AppRouter } from '@kachingga/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { createTRPCClient, TRPCClientError, type TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import type { ReactElement } from 'react';

import { TRPCProvider } from '@/lib/trpc';

// Fake API for screen tests: map a procedure path ("groups.get") to what it returns.
// A handler may return data, a Promise (to keep the screen loading), or throw apiError(...).
export type ApiHandlers = Partial<Record<string, (input: unknown) => unknown>>;

export function apiError(message: string, code = 'BAD_REQUEST') {
  return new TRPCClientError(message, { result: { error: { message, code: -32600, data: { code } } } } as never);
}

/** A promise that never resolves: keeps a query in its loading state. */
export const neverResolves = () => new Promise(() => {});

function fakeLink(handlers: ApiHandlers): TRPCLink<AppRouter> {
  return () =>
    ({ op }) =>
      observable((observer) => {
        const handler = handlers[op.path];
        if (!handler) {
          observer.error(apiError(`Sin handler de test para "${op.path}"`, 'NOT_FOUND'));
          return;
        }
        Promise.resolve()
          .then(() => handler(op.input))
          .then((data) => {
            observer.next({ result: { type: 'data', data } });
            observer.complete();
          })
          .catch((e: unknown) => observer.error(e instanceof TRPCClientError ? e : apiError(String(e))));
      });
}

/**
 * Renders `ui` with the same providers as the app, but against `api` instead of the real server.
 * Async like RNTL v14's `render`: always `await renderWithApi(...)`.
 */
export async function renderWithApi(ui: ReactElement, api: ApiHandlers = {}) {
  // gcTime: Infinity → no cache-cleanup timers left running, so Jest can exit.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const trpcClient = createTRPCClient<AppRouter>({ links: [fakeLink(api)] });
  return await render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {ui}
      </TRPCProvider>
    </QueryClientProvider>,
  );
}
