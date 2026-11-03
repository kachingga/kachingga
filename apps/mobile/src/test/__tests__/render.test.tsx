// Example of a screen "content validation" test. Copy this pattern for every screen:
// one test per state (loading, empty, error, data) asserting what the user sees.
import { useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useTRPC } from '@/lib/trpc';
import { apiError, neverResolves, renderWithApi } from '@/test/render';

function GroupName({ groupId }: { groupId: string }) {
  const trpc = useTRPC();
  const group = useQuery(trpc.groups.get.queryOptions({ groupId }));
  if (group.isPending) return <Text>Cargando…</Text>;
  if (group.isError) return <Text>{group.error.message}</Text>;
  return <Text>{group.data.name}</Text>;
}

describe('renderWithApi', () => {
  it('shows the loading state while the API has not answered', async () => {
    await renderWithApi(<GroupName groupId="g1" />, { 'groups.get': neverResolves });
    expect(screen.getByText('Cargando…')).toBeOnTheScreen();
  });

  it('shows the data returned by the fake API', async () => {
    await renderWithApi(<GroupName groupId="g1" />, {
      'groups.get': () => ({ id: 'g1', name: 'Viaje a Bariloche', participants: [] }),
    });
    expect(await screen.findByText('Viaje a Bariloche')).toBeOnTheScreen();
  });

  it('shows the API error message in Spanish', async () => {
    await renderWithApi(<GroupName groupId="g1" />, {
      'groups.get': () => {
        throw apiError('Grupo no encontrado', 'NOT_FOUND');
      },
    });
    expect(await screen.findByText('Grupo no encontrado')).toBeOnTheScreen();
  });

  it('passes the input the screen sends', async () => {
    const calls: unknown[] = [];
    await renderWithApi(<GroupName groupId="g42" />, {
      'groups.get': (input) => {
        calls.push(input);
        return { id: 'g42', name: 'Depto' };
      },
    });
    await screen.findByText('Depto');
    expect(calls).toEqual([{ groupId: 'g42' }]);
  });
});
