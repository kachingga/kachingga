import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { endOfDay, startOfDay } from '@/lib/format';
import { neverResolves, renderWithApi } from '@/test/render';
import { Filters } from '@/routes/groups/filters';

const fixGroup = {
  id: 'g1',
  name: 'Viaje',
  baseCurrency: 'ARS',
  inviteCode: 'ABC12345',
  archivedAt: null,
  createdById: 'u1',
  myParticipantId: 'p1',
  participants: [
    {
      id: 'p1',
      name: 'Juan',
      hasAccount: true,
      isMe: true,
      paymentAlias: null,
      paymentAliasSource: null,
    },
    {
      id: 'p2',
      name: 'Tuke',
      hasAccount: true,
      isMe: false,
      paymentAlias: null,
      paymentAliasSource: null,
    },
  ],
};

const expense = {
  id: 'e1',
  description: 'Cena',
  categoryId: 'cat-food',
  category: { id: 'cat-food', name: 'Comida', icon: 'utensils', color: 'chart-2' },
  date: new Date('2026-11-10T12:00:00Z'),
  amountCents: 80000,
  currency: 'ARS',
  exchangeRate: null,
  splitType: 'EQUAL',
  paidById: 'p1',
  createdById: 'u1',
  deletedAt: null,
  groupId: 'g1',
  paidBy: { id: 'p1', name: 'Juan' },
  splits: [],
};

/** Handlers that record the filters each list call got. */
function api(listCalls: unknown[] = []) {
  return {
    'groups.get': () => fixGroup,
    'categories.list': () => [
      {
        id: 'cat-food',
        name: 'Comida',
        icon: 'utensils',
        color: 'chart-2',
        defaultKey: 'FOOD',
        archived: false,
        expenseCount: 1,
      },
      {
        id: 'cat-other',
        name: 'Otros',
        icon: 'shapes',
        color: 'muted',
        defaultKey: 'OTHER',
        archived: false,
        expenseCount: 0,
      },
    ],
    'expenses.list': (input: unknown) => {
      listCalls.push((input as { filters: unknown }).filters);
      return { items: [expense], nextCursor: null };
    },
    'expenses.summary': () => [],
    'savedFilters.list': () => [],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Filters', () => {
  it('shows loading state for expenses', () => {
    renderWithApi(<Filters />, {
      'groups.get': neverResolves,
      'expenses.list': neverResolves,
      'expenses.summary': neverResolves,
      'savedFilters.list': neverResolves,
    });
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('shows filter shortcuts', async () => {
    renderWithApi(<Filters />, {
      'groups.get': () => fixGroup,
      'expenses.list': () => ({ items: [], nextCursor: null }),
      'expenses.summary': () => [],
      'savedFilters.list': () => [],
    });
    expect(await screen.findByRole('button', { name: 'Mis gastos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Este mes' })).toBeInTheDocument();
  });

  it('shows empty expenses state', async () => {
    renderWithApi(<Filters />, {
      'groups.get': () => fixGroup,
      'expenses.list': () => ({ items: [], nextCursor: null }),
      'expenses.summary': () => [],
      'savedFilters.list': () => [],
    });
    expect(await screen.findByText('No hay gastos con estos filtros.')).toBeInTheDocument();
  });

  it('shows export buttons', async () => {
    renderWithApi(<Filters />, {
      'groups.get': () => fixGroup,
      'expenses.list': () => ({ items: [], nextCursor: null }),
      'expenses.summary': () => [],
      'savedFilters.list': () => [],
    });
    expect(await screen.findByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar JSON' })).toBeInTheDocument();
  });

  it('reads the filters from the URL (they survive going back)', async () => {
    const calls: unknown[] = [];
    renderWithApi(<Filters />, api(calls), '/grupos/g1/filtros?para=p2&min=1000&q=cena');
    expect(await screen.findByText('Cena')).toBeInTheDocument();
    expect(calls.at(-1)).toEqual({
      splitParticipantId: 'p2',
      minAmountCents: 100000,
      search: 'cena',
    });
    expect(screen.getByLabelText('Le corresponde a')).toHaveValue('p2');
    expect(screen.getByLabelText('Descripción')).toHaveValue('cena');
  });

  it('filters by who it belongs to and by amount', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    renderWithApi(<Filters />, api(calls));
    await screen.findByText('Cena');
    await user.selectOptions(screen.getByLabelText('Le corresponde a'), 'p2');
    await user.type(screen.getByLabelText('Monto mínimo'), '500');
    await waitFor(() =>
      expect(calls.at(-1)).toEqual({ splitParticipantId: 'p2', minAmountCents: 50000 }),
    );
  });

  it('picks a month as a range from the 1st to the last day', async () => {
    const calls: unknown[] = [];
    renderWithApi(<Filters />, api(calls));
    await screen.findByText('Cena');
    fireEvent.change(screen.getByLabelText('Mes'), { target: { value: '2026-02' } });
    await waitFor(() =>
      expect(calls.at(-1)).toEqual({
        dateFrom: startOfDay('2026-02-01'),
        dateTo: endOfDay('2026-02-28'),
      }),
    );
    expect(screen.getByLabelText('Mes')).toHaveValue('2026-02');
  });

  it('saves the current filters with a name', async () => {
    const user = userEvent.setup();
    const created: unknown[] = [];
    renderWithApi(
      <Filters />,
      {
        ...api(),
        'savedFilters.create': (input) => {
          created.push(input);
          return { id: 'sf1' };
        },
      },
      '/grupos/g1/filtros?pago=p1',
    );
    await screen.findByText('Cena');
    await user.type(screen.getByLabelText('Nombre del filtro'), 'Lo que pagué');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(created).toEqual([
        { groupId: undefined, name: 'Lo que pagué', filters: { paidById: 'p1' } },
      ]),
    );
  });

  it('applies a saved filter', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    renderWithApi(<Filters />, {
      ...api(calls),
      'savedFilters.list': () => [
        { id: 'sf1', name: 'Solo comida', filters: { categoryIds: ['cat-food'] } },
      ],
    });
    await user.click(await screen.findByRole('button', { name: 'Solo comida' }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ categoryIds: ['cat-food'] }));
    expect(screen.getByRole('button', { name: 'Comida', pressed: true })).toBeInTheDocument();
  });

  it('exports what matches the filters', async () => {
    const user = userEvent.setup();
    const exported: unknown[] = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }),
    );
    renderWithApi(
      <Filters />,
      {
        ...api(),
        'expenses.export': (input) => {
          exported.push(input);
          return { filename: 'gastos.csv', mimeType: 'text/csv', content: 'a,b' };
        },
      },
      '/grupos/g1/filtros?pago=p1',
    );
    await screen.findByText('Cena');
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() =>
      expect(exported).toEqual([
        { groupId: undefined, filters: { paidById: 'p1' }, format: 'csv' },
      ]),
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('opens the detail of a filtered expense', async () => {
    renderWithApi(<Filters />, api());
    expect(await screen.findByRole('link', { name: /Cena/ })).toHaveAttribute(
      'href',
      '/grupos/undefined/gastos/e1',
    );
  });
});
