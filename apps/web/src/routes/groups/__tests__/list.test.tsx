import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { GroupList } from '@/routes/groups/list';

const fixGroups = [
  {
    id: 'g1',
    name: 'Viaje a Floripa',
    baseCurrency: 'ARS',
    archivedAt: null,
    _count: { participants: 3 },
    myBalanceCents: 150000,
  },
  {
    id: 'g2',
    name: 'Depto Palermo',
    baseCurrency: 'ARS',
    archivedAt: null,
    _count: { participants: 2 },
    myBalanceCents: -2550,
  },
];

describe('GroupList', () => {
  it('shows loading skeletons', () => {
    renderWithApi(<GroupList />, { 'groups.list': neverResolves });
    expect(screen.getByRole('heading', { name: 'Grupos' })).toBeInTheDocument();
  });

  it('shows groups when loaded', async () => {
    renderWithApi(<GroupList />, { 'groups.list': () => fixGroups });
    expect(await screen.findByText('Viaje a Floripa')).toBeInTheDocument();
    expect(screen.getByText('Depto Palermo')).toBeInTheDocument();
  });

  it('shows my balance in each group', async () => {
    renderWithApi(<GroupList />, {
      'groups.list': () => [
        ...fixGroups,
        { ...fixGroups[0], id: 'g3', name: 'Asado', myBalanceCents: 0 },
      ],
    });
    expect(await screen.findByText(/Te deben \$\s?1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/Debés \$\s?25,50/)).toBeInTheDocument();
    expect(screen.getByText('Estás al día')).toBeInTheDocument();
  });

  it('shows empty state when there are no groups', async () => {
    renderWithApi(<GroupList />, { 'groups.list': () => [] });
    expect(await screen.findByText('Todavía no tenés grupos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear grupo' })).toHaveAttribute(
      'href',
      '/grupos/crear',
    );
    expect(screen.getByRole('link', { name: 'Unirme con código' })).toHaveAttribute(
      'href',
      '/grupos/unirme',
    );
  });

  it('shows error state', async () => {
    renderWithApi(<GroupList />, {
      'groups.list': () => {
        throw apiError('Error de red');
      },
    });
    expect(await screen.findByText('Error de red')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('shows bottom nav', () => {
    renderWithApi(<GroupList />, { 'groups.list': neverResolves });
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });

  it('retries after an error', async () => {
    const user = userEvent.setup();
    let calls = 0;
    renderWithApi(<GroupList />, {
      'groups.list': () => {
        calls += 1;
        if (calls === 1) throw apiError('Error de red');
        return [];
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Todavía no tenés grupos')).toBeInTheDocument();
  });

  it('preloads a group when touching its card, before opening it', async () => {
    const loaded: string[] = [];
    const record = (path: string) => (input: unknown) => {
      loaded.push(`${path} ${JSON.stringify(input)}`);
      return new Promise(() => {});
    };
    renderWithApi(<GroupList />, {
      'groups.list': () => fixGroups,
      'groups.get': record('groups.get'),
      'balances.get': record('balances.get'),
      'expenses.list': record('expenses.list'),
    });
    const card = await screen.findByRole('button', { name: /Viaje a Floripa/ });
    fireEvent.pointerDown(card);

    await waitFor(() =>
      expect(loaded).toEqual(
        expect.arrayContaining([
          'groups.get {"groupId":"g1"}',
          'balances.get {"groupId":"g1"}',
          expect.stringContaining('expenses.list {"groupId":"g1"'),
        ]),
      ),
    );
  });
});
