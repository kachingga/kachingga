import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { neverResolves, renderWithApi } from '@/test/render';
import { ExpenseForm } from '@/routes/groups/expense-form';

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

describe('ExpenseForm (new expense)', () => {
  it('shows loading state while group loads', () => {
    renderWithApi(<ExpenseForm />, { 'groups.get': neverResolves });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('shows the form once group loads', async () => {
    renderWithApi(<ExpenseForm />, { 'groups.get': () => fixGroup });
    expect(await screen.findByLabelText('Monto')).toBeInTheDocument();
    expect(screen.getByLabelText('Descripción')).toBeInTheDocument();
    expect(screen.getByLabelText('Quién pagó')).toBeInTheDocument();
  });

  it('shows all participants in the split', async () => {
    renderWithApi(<ExpenseForm />, { 'groups.get': () => fixGroup });
    await screen.findByLabelText('Monto');
    expect(screen.getAllByText('Juan (yo)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tuke').length).toBeGreaterThan(0);
  });
});
