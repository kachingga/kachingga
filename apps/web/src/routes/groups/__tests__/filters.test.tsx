import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
  ],
};

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
});
