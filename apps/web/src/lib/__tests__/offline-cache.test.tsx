import { onlineManager, QueryClient, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CachedApiProvider } from '@/components/api-provider';
import { OfflineBanner } from '@/components/offline-banner';
import {
  cachedUser,
  clearOfflineCache,
  createMutationCache,
  OFFLINE_MESSAGE,
  rememberCachedUser,
} from '@/lib/offline-cache';
import { useTRPC } from '@/lib/trpc';
import { createFakeApiClient, neverResolves, type ApiHandlers } from '@/test/render';

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
