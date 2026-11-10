import { onlineManager, QueryClient, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiProvider, CachedApiProvider } from '@/components/api-provider';
import { OfflineBanner } from '@/components/offline-banner';
import {
  cachedUser,
  clearOfflineCache,
  createMutationCache,
  createPersister,
  OFFLINE_MESSAGE,
  rememberCachedUser,
  syncOfflineCacheWithSession,
} from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';
import { useTRPC } from '@/lib/trpc';
import { createFakeApiClient, neverResolves, type ApiHandlers } from '@/test/render';

// The session ApiProvider sees (the rest of the file doesn't use it).
const auth = vi.hoisted(() => ({ session: undefined as unknown }));
vi.mock('@/lib/auth', () => ({ useSession: () => auth.session, getAccessToken: async () => null }));

const groups = [{ id: 'g1', name: 'Viaje a Floripa', createdAt: new Date('2026-11-01T12:00:00Z') }];

function GroupNames() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.groups.list.queryOptions());
  const list = data as unknown as typeof groups | undefined;
  return (
    <ul>
      {list?.map((g) => (
        <li key={g.id}>
          {g.name} ({g.createdAt instanceof Date ? 'fecha' : 'texto'})
        </li>
      ))}
    </ul>
  );
}

function renderAs(userId: string | null, api: ApiHandlers) {
  return render(
    <CachedApiProvider userId={userId} trpcClient={createFakeApiClient(api)} persistThrottle={0}>
      <GroupNames />
    </CachedApiProvider>,
  );
}

const savedKeys = () => Object.keys(localStorage).filter((k) => k.startsWith('kachingga-cache'));

beforeEach(() => localStorage.clear());
afterEach(() => onlineManager.setOnline(true));

describe('offline cache', () => {
  it('restores the last data for the same user without asking the API', async () => {
    const first = renderAs('u1', { 'groups.list': () => groups });
    expect(await screen.findByText('Viaje a Floripa (fecha)')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('kachingga-cache:u1')).toContain('Floripa'));
    first.unmount();

    renderAs('u1', { 'groups.list': neverResolves });
    // Restored from the device, Dates included.
    expect(await screen.findByText('Viaje a Floripa (fecha)')).toBeInTheDocument();
  });

  it("never shows another user's saved data", async () => {
    const first = renderAs('u1', { 'groups.list': () => groups });
    await waitFor(() => expect(localStorage.getItem('kachingga-cache:u1')).toContain('Floripa'));
    first.unmount();

    renderAs('u2', { 'groups.list': neverResolves });
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(screen.queryByText(/Viaje a Floripa/)).not.toBeInTheDocument();
  });

  it('saves nothing without a user', async () => {
    renderAs(null, { 'groups.list': () => groups });
    expect(await screen.findByText('Viaje a Floripa (fecha)')).toBeInTheDocument();
    expect(savedKeys()).toEqual([]);
  });

  it('clearOfflineCache deletes every saved cache and the remembered user', () => {
    localStorage.setItem('kachingga-cache:u1', '{}');
    localStorage.setItem('kachingga-cache:u2', '{}');
    localStorage.setItem('otra-cosa', 'x');
    rememberCachedUser('u1');
    expect(cachedUser()).toBe('u1');

    clearOfflineCache();

    expect(savedKeys()).toEqual([]);
    expect(cachedUser()).toBeNull();
    expect(localStorage.getItem('otra-cosa')).toBe('x');
  });

  it('a save still pending when the caches are deleted does not write them back', async () => {
    const empty = {
      timestamp: Date.now(),
      buster: '',
      clientState: { queries: [], mutations: [] },
    };
    // Saves are throttled: this one is still waiting when the session ends.
    createPersister('u1', 20).persistClient(empty);
    clearOfflineCache();
    await act(() => new Promise((r) => setTimeout(r, 40)));
    expect(savedKeys()).toEqual([]);

    // The next one to log in saves as usual.
    createPersister('u2', 0).persistClient(empty);
    await waitFor(() => expect(savedKeys()).toEqual(['kachingga-cache:u2']));
  });
});

describe('offline cache and the session', () => {
  // The tests' Supabase URL is https://test.supabase.co: the library keeps the session here.
  const saveSession = (userId: string, refreshToken: string, expiresAt: number) =>
    localStorage.setItem(
      'sb-test-auth-token',
      JSON.stringify({
        access_token: 'access-token',
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: expiresAt,
        user: { id: userId },
      }),
    );
  const now = () => Math.floor(Date.now() / 1000);

  let stop: (() => void) | undefined;
  afterEach(() => {
    stop?.();
    vi.unstubAllGlobals();
  });

  it('is deleted when the session was closed on another device', async () => {
    localStorage.setItem('kachingga-cache:u1', '{}');
    rememberCachedUser('u1');
    saveSession('u1', 'revoked-refresh-token', now() - 60);
    // Supabase rejects the refresh token: the library deletes the session and fires SIGNED_OUT.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' },
          { status: 400 },
        ),
      ),
    );
    stop = syncOfflineCacheWithSession();

    expect((await supabase.auth.getSession()).data.session).toBeNull();
    await waitFor(() => expect(savedKeys()).toEqual([]));
    expect(cachedUser()).toBeNull();
  });

  it("with a session, only that user's cache stays on the device", async () => {
    localStorage.setItem('kachingga-cache:u1', '{}');
    localStorage.setItem('kachingga-cache:u2', '{}');
    saveSession('u2', 'valid-refresh-token', now() + 3600);

    stop = syncOfflineCacheWithSession();

    await waitFor(() => expect(savedKeys()).toEqual(['kachingga-cache:u2']));
  });
});

describe('offline mutations', () => {
  it('fail right away, before the optimistic update, and never reach the API', async () => {
    const queryClient = new QueryClient({ mutationCache: createMutationCache() });
    const onMutate = vi.fn();
    const mutationFn = vi.fn();
    onlineManager.setOnline(false);

    const mutation = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn, onMutate, retry: false });
    await expect(mutation.execute({})).rejects.toThrow(OFFLINE_MESSAGE);

    expect(onMutate).not.toHaveBeenCalled();
    expect(mutationFn).not.toHaveBeenCalled();
  });

  it('run normally with connection', async () => {
    const queryClient = new QueryClient({ mutationCache: createMutationCache() });
    const mutationFn = vi.fn().mockResolvedValue('ok');

    const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn });
    await expect(mutation.execute({})).resolves.toBe('ok');
  });
});

describe('OfflineBanner', () => {
  it('shows while offline and goes away when the connection is back', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => onlineManager.setOnline(false));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin conexión: mostrando lo último que viste',
    );

    act(() => onlineManager.setOnline(true));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('ApiProvider while the session is being restored', () => {
  // Offline with an expired token Supabase retries refreshing it for ~25 s: the session stays undefined.
  async function saveCacheOf(userId: string) {
    const first = renderAs(userId, { 'groups.list': () => groups });
    await waitFor(() =>
      expect(localStorage.getItem(`kachingga-cache:${userId}`)).toContain('Floripa'),
    );
    first.unmount();
    rememberCachedUser(userId);
  }
  const renderApp = () =>
    render(
      <ApiProvider>
        <GroupNames />
      </ApiProvider>,
    );

  beforeEach(() => {
    auth.session = undefined;
  });
  // Its persister saves with a 1 s throttle: that it doesn't write into the next test.
  afterEach(() => clearOfflineCache());

  it("offline with the last user's cache, shows the saved data right away", async () => {
    await saveCacheOf('u1');
    onlineManager.setOnline(false);
    renderApp();
    expect(await screen.findByText('Viaje a Floripa (fecha)')).toBeInTheDocument();
  });

  it('online, shows the splash and nothing saved until the session is restored', async () => {
    await saveCacheOf('u1');
    renderApp();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(screen.queryByText(/Viaje a Floripa/)).not.toBeInTheDocument();
  });

  it('offline with nothing saved, shows the splash', () => {
    onlineManager.setOnline(false);
    renderApp();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });
});
