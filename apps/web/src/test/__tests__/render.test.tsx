// Example of a screen "content validation" test. Copy this pattern for every screen:
// one test per state (loading, empty, error, data) asserting what the user sees.
import { useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useTRPC } from '@/lib/trpc';
import { apiError, neverResolves, renderWithApi } from '@/test/render';

function GroupName({ groupId }: { groupId: string }) {
  const trpc = useTRPC();
  const group = useQuery(trpc.groups.get.queryOptions({ groupId }));
  if (group.isPending) return <p>Cargando…</p>;
  if (group.isError) return <p>{group.error.message}</p>;
  return <p>{group.data.name}</p>;
}

describe('renderWithApi', () => {
  it('shows the loading state while the API has not answered', () => {
    renderWithApi(<GroupName groupId="g1" />, { 'groups.get': neverResolves });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('shows the data returned by the fake API', async () => {
    renderWithApi(<GroupName groupId="g1" />, {
      'groups.get': () => ({ id: 'g1', name: 'Viaje a Bariloche', participants: [] }),
    });
    expect(await screen.findByText('Viaje a Bariloche')).toBeInTheDocument();
  });

  it('shows the API error message in Spanish', async () => {
    renderWithApi(<GroupName groupId="g1" />, {
      'groups.get': () => {
        throw apiError('Grupo no encontrado', 'NOT_FOUND');
      },
    });
    expect(await screen.findByText('Grupo no encontrado')).toBeInTheDocument();
  });

  it('passes the input the screen sends', async () => {
    const calls: unknown[] = [];
    renderWithApi(<GroupName groupId="g42" />, {
      'groups.get': (input) => {
        calls.push(input);
        return { id: 'g42', name: 'Depto' };
      },
    });
    await screen.findByText('Depto');
    expect(calls).toEqual([{ groupId: 'g42' }]);
  });
});
