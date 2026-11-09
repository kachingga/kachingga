import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { neverResolves, renderWithApi } from '@/test/render';
import { GroupDetail } from '@/routes/groups/detail';

const fixGroup = {
  id: 'g1',
  name: 'Viaje a Floripa',
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
      paymentAlias: 'juan.alias',
      paymentAliasSource: 'account' as const,
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

const fixBalances = [
  {
    currency: 'ARS',
    balances: [
      { participantId: 'p1', amountCents: 500000 },
      { participantId: 'p2', amountCents: -500000 },
    ],
    transfers: [{ fromId: 'p2', toId: 'p1', amountCents: 500000 }],
  },
];

const fixExpenses = { items: [], nextCursor: null };

describe('GroupDetail', () => {
  it('shows loading state', () => {
    renderWithApi(<GroupDetail />, {
      'groups.get': neverResolves,
      'balances.get': neverResolves,
      'expenses.list': neverResolves,
    });
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('shows group name and empty expense list', async () => {
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
    });
    expect(await screen.findByText('Viaje a Floripa')).toBeInTheDocument();
    expect(await screen.findByText('Todavía no hay gastos.')).toBeInTheDocument();
  });

  it('shows balances', async () => {
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
    });
    expect(await screen.findByText(/Te deben/)).toBeInTheDocument();
  });

  it('shows expenses in the list', async () => {
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => ({
        items: [
          {
            id: 'e1',
            description: 'Cena en el porto',
            categoryId: 'cat-food',
            category: { id: 'cat-food', name: 'Comida', icon: 'utensils', color: 'chart-2' },
            date: new Date('2024-01-15'),
            amountCents: 80000,
            currency: 'ARS',
            exchangeRate: null,
            splitType: 'EQUAL',
            paidById: 'p1',
            createdById: 'u1',
            deletedAt: null,
            groupId: 'g1',
            paidBy: { id: 'p1', name: 'Juan' },
            splits: [
              {
                expenseId: 'e1',
                participantId: 'p1',
                amountCents: 40000,
                percentage: null,
                participant: { id: 'p1', name: 'Juan' },
              },
              {
                expenseId: 'e1',
                participantId: 'p2',
                amountCents: 40000,
                percentage: null,
                participant: { id: 'p2', name: 'Tuke' },
              },
            ],
          },
        ],
        nextCursor: null,
      }),
    });
    expect(await screen.findByText('Cena en el porto')).toBeInTheDocument();
    expect(screen.getByText(/^vos: \$\s?400,00$/)).toBeInTheDocument();
  });

  it('shows an expense that is still being saved, without a link to it', async () => {
    const saving = {
      id: 'temp-1',
      description: 'Pizza',
      categoryId: 'cat-food',
      category: { id: 'cat-food', name: 'Comida', icon: 'utensils', color: 'chart-2' },
      date: new Date('2026-11-04T12:00:00Z'),
      amountCents: 300000,
      currency: 'ARS',
      exchangeRate: null,
      splitType: 'EQUAL',
      paidById: 'p1',
      paidBy: { id: 'p1', name: 'Juan' },
      splits: [],
    };
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => ({ items: [saving], nextCursor: null }),
    });
    expect(await screen.findByText('Pizza')).toBeInTheDocument();
    expect(screen.getByText('Guardando…')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pizza/ })).not.toBeInTheDocument();
  });

  it('archives the group after confirming', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
      'groups.setArchived': (input) => {
        calls.push(input);
        return { ok: true };
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Opciones del grupo' }));
    await user.click(screen.getByRole('button', { name: 'Archivar grupo' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('¿Archivar este grupo?');
    await user.click(within(dialog).getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(calls).toEqual([{ groupId: undefined, archived: true }]));
  });

  it('renames the group', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
      'groups.rename': (input) => {
        calls.push(input);
        return { ...fixGroup, name: 'Floripa 2027' };
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Opciones del grupo' }));
    await user.click(screen.getByRole('button', { name: 'Renombrar grupo' }));
    const input = screen.getByDisplayValue('Viaje a Floripa');
    await user.clear(input);
    await user.type(input, 'Floripa 2027');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(calls).toEqual([{ groupId: undefined, name: 'Floripa 2027' }]));
  });

  it('an archived group is read-only, with a way to unarchive it', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    renderWithApi(<GroupDetail />, {
      'groups.get': () => ({ ...fixGroup, archivedAt: new Date('2026-11-01') }),
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
      'groups.setArchived': (input) => {
        calls.push(input);
        return { ok: true };
      },
    });
    expect(await screen.findByText('Grupo archivado.')).toBeInTheDocument();
    expect(await screen.findByText(/Te deben/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Agregar gasto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Agregar uno' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como pagado' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Opciones del grupo' }));
    expect(screen.queryByRole('button', { name: 'Renombrar grupo' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Desarchivar' }));
    await waitFor(() => expect(calls).toEqual([{ groupId: 'g1', archived: false }]));
  });
});
