import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { GroupList } from '@/routes/groups/list';

// The greeting uses the name of the Google account, when there is one.
const auth = vi.hoisted(() => ({ session: null as unknown }));
vi.mock('@/lib/auth', () => ({ useSession: () => auth.session }));
beforeEach(() => {
  auth.session = null;
});

const fixGroups = [
  {
    id: 'g1',
    name: 'Viaje a Floripa',
    baseCurrency: 'ARS',
    archivedAt: null,
    _count: { participants: 3 },
    participants: [
      { id: 'p1', name: 'Juan' },
      { id: 'p2', name: 'Tuke' },
      { id: 'p3', name: 'Flor' },
    ],
    myBalanceCents: 150000,
  },
  {
    id: 'g2',
    name: 'Depto Palermo',
    baseCurrency: 'ARS',
    archivedAt: null,
    _count: { participants: 2 },
    participants: [
      { id: 'p4', name: 'Juan' },
      { id: 'p5', name: 'Naiara' },
    ],
    myBalanceCents: -2550,
  },
];

describe('GroupList', () => {
  it('shows loading skeletons', () => {
    renderWithApi(<GroupList />, { 'groups.list': neverResolves });
    expect(screen.getByRole('heading', { name: 'Mis grupos' })).toBeInTheDocument();
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

  it('greets by the first name of the Google account, or just "¡Hola!"', async () => {
    auth.session = { user: { user_metadata: { full_name: 'Galo Belloponce' } } };
    const { unmount } = renderWithApi(<GroupList />, { 'groups.list': () => fixGroups });
    expect(screen.getByText('¡Hola, Galo!')).toBeInTheDocument();
    unmount();

    auth.session = { user: { email: 'juan@example.com', user_metadata: {} } };
    renderWithApi(<GroupList />, { 'groups.list': () => fixGroups });
    expect(screen.getByText('¡Hola!')).toBeInTheDocument();
  });

  it('shows how many people each group has, with their faces', async () => {
    const big = {
      ...fixGroups[0],
      id: 'g3',
      name: 'Egresados',
      _count: { participants: 7 },
      participants: ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fede', 'Gabi'].map((name, i) => ({
        id: `q${i}`,
        name,
      })),
    };
    renderWithApi(<GroupList />, { 'groups.list': () => [...fixGroups, big] });
    const card = await screen.findByRole('button', { name: /Egresados/ });
    expect(card).toHaveTextContent('7 participantes');
    // Up to 5 faces (initials) and "+2" for the rest.
    expect(card).toHaveTextContent(/ABCDE\+2/);
    expect(screen.getByRole('button', { name: /Depto Palermo/ })).toHaveTextContent(
      '2 participantes',
    );
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

  it('offers to create or join a group when there are groups', async () => {
    renderWithApi(<GroupList />, { 'groups.list': () => fixGroups });
    await screen.findByText('Viaje a Floripa');
    expect(screen.getByRole('link', { name: 'Crear grupo' })).toHaveAttribute(
      'href',
      '/grupos/crear',
    );
    expect(screen.getByRole('link', { name: 'Unirme con código' })).toHaveAttribute(
      'href',
      '/grupos/unirme',
    );
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
