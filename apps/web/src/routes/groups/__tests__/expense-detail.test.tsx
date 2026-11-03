import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { neverResolves, renderWithApi } from '@/test/render';
import { ExpenseDetail } from '@/routes/groups/expense-detail';

const fixExpense = {
  id: 'e1',
  description: 'Cena',
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
};

describe('ExpenseDetail', () => {
  it('shows loading state', () => {
    renderWithApi(<ExpenseDetail />, { 'expenses.get': neverResolves });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('shows expense details', async () => {
    renderWithApi(<ExpenseDetail />, { 'expenses.get': () => fixExpense });
    expect(await screen.findByText('Cena')).toBeInTheDocument();
    expect(screen.getAllByText('Juan').length).toBeGreaterThan(0);
  });

  it('shows edit and delete buttons', async () => {
    renderWithApi(<ExpenseDetail />, { 'expenses.get': () => fixExpense });
    await screen.findByText('Cena');
    expect(screen.getByRole('link', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument();
  });
});
