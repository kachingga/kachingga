import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { neverResolves, renderWithApi } from '@/test/render';
import { Settlements } from '@/routes/groups/settlements';

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

describe('Settlements', () => {
  it('shows loading state', () => {
    renderWithApi(<Settlements />, {
      'groups.get': neverResolves,
      'settlements.list': neverResolves,
    });
    // Shows while loading (either header or loading text)
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('shows register payment button', async () => {
    renderWithApi(<Settlements />, {
      'groups.get': () => fixGroup,
      'settlements.list': () => [],
    });
    expect(await screen.findByRole('button', { name: '+ Registrar pago' })).toBeInTheDocument();
  });

  it('shows empty state when no settlements', async () => {
    renderWithApi(<Settlements />, {
      'groups.get': () => fixGroup,
      'settlements.list': () => [],
    });
    expect(await screen.findByText('Todavía no hay pagos registrados.')).toBeInTheDocument();
  });

  it('shows settlements list', async () => {
    renderWithApi(<Settlements />, {
      'groups.get': () => fixGroup,
      'settlements.list': () => [
        {
          id: 's1',
          fromId: 'p2',
          toId: 'p1',
          amountCents: 500000,
          currency: 'ARS',
          exchangeRate: null,
          date: new Date('2024-01-20'),
          note: null,
          deletedAt: null,
          groupId: 'g1',
          createdById: 'u1',
          from: { id: 'p2', name: 'Tuke' },
          to: { id: 'p1', name: 'Juan' },
        },
      ],
    });
    expect(await screen.findByText('Tuke → Juan')).toBeInTheDocument();
  });
});
