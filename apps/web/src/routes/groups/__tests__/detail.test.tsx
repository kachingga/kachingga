import { screen } from '@testing-library/react';
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
            category: 'FOOD',
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
  });
});
