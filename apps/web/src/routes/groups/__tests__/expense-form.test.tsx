import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { dayToDate, today } from '@/lib/format';

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
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
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

describe('ExpenseForm (amounts, dates and currencies)', () => {
  async function fillBasics(user: ReturnType<typeof userEvent.setup>, amount: string) {
    await user.type(await screen.findByLabelText('Monto'), amount);
    await user.type(screen.getByLabelText('Descripción'), 'Cena');
  }

  function captureCreate() {
    const calls: Record<string, unknown>[] = [];
    return {
      calls,
      handler: (input: unknown) => {
        calls.push(input as Record<string, unknown>);
        return { id: 'e1' };
      },
    };
  }

  it('reads amounts written the Argentine way ("1.500" is fifteen hundred)', async () => {
    const user = userEvent.setup();
    const create = captureCreate();
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => fixGroup,
      'expenses.create': create.handler,
    });
    await fillBasics(user, '1.500');
    await user.click(screen.getByRole('button', { name: 'Agregar gasto' }));

    await waitFor(() => expect(create.calls).toHaveLength(1));
    expect(create.calls[0]).toMatchObject({
      amountCents: 150000,
      currency: 'ARS',
      exchangeRate: null,
      keepCurrency: false,
      date: dayToDate(today()),
    });
  });

  it('converts dollars with the suggested blue rate by default', async () => {
    const user = userEvent.setup();
    const create = captureCreate();
    const rateInputs: unknown[] = [];
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => fixGroup,
      'rates.get': (input) => {
        rateInputs.push(input);
        return { buy: 1545, sell: 1565, mid: 1555, updatedAt: new Date(), source: 'blue' };
      },
      'expenses.create': create.handler,
    });
    await fillBasics(user, '20');
    await user.selectOptions(screen.getByLabelText('Moneda'), 'USD');
    expect(await screen.findByDisplayValue('1555')).toBeInTheDocument();
    expect(screen.getByText('≈ $ 31.100,00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar gasto' }));

    await waitFor(() => expect(create.calls).toHaveLength(1));
    expect(rateInputs[0]).toEqual({ currency: 'USD', source: 'blue' });
    expect(create.calls[0]).toMatchObject({
      currency: 'USD',
      exchangeRate: 1555,
      keepCurrency: false,
    });
  });

  it('between two foreign currencies, sends the rate typed by hand', async () => {
    const user = userEvent.setup();
    const create = captureCreate();
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => ({ ...fixGroup, baseCurrency: 'USD' }),
      'expenses.create': create.handler,
    });
    await fillBasics(user, '100');
    await user.selectOptions(screen.getByLabelText('Moneda'), 'EUR');
    // Only one rate field, and no suggested sources.
    expect(screen.getAllByLabelText(/Tipo de cambio/)).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Blue' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/Tipo de cambio: 1 EUR =/), '1,08');
    await user.click(screen.getByRole('button', { name: 'Agregar gasto' }));

    await waitFor(() => expect(create.calls).toHaveLength(1));
    expect(create.calls[0]).toMatchObject({ currency: 'EUR', exchangeRate: 1.08 });
  });

  it('in a dollar group, shows pesos as "1 USD = X ARS" and stores 1 ARS in USD', async () => {
    const user = userEvent.setup();
    const create = captureCreate();
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => ({ ...fixGroup, baseCurrency: 'USD' }),
      'rates.get': () => ({
        buy: 1545,
        sell: 1565,
        mid: 1555,
        updatedAt: new Date(),
        source: 'blue',
      }),
      'expenses.create': create.handler,
    });
    await fillBasics(user, '31.100');
    await user.selectOptions(screen.getByLabelText('Moneda'), 'ARS');
    expect(await screen.findByLabelText(/Tipo de cambio: 1 USD =/)).toHaveValue('1555');
    await user.click(screen.getByRole('button', { name: 'Agregar gasto' }));

    await waitFor(() => expect(create.calls).toHaveLength(1));
    expect(create.calls[0]!.exchangeRate).toBeCloseTo(1 / 1555, 10);
  });

  it("doesn't submit while a conversion has no rate", async () => {
    const user = userEvent.setup();
    const create = captureCreate();
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => fixGroup,
      'rates.get': neverResolves,
      'expenses.create': create.handler,
    });
    await fillBasics(user, '20');
    await user.selectOptions(screen.getByLabelText('Moneda'), 'USD');
    await user.click(screen.getByRole('button', { name: 'Agregar gasto' }));

    expect(
      await screen.findByText('Esperá a que cargue la cotización o cargala a mano'),
    ).toBeInTheDocument();
    expect(create.calls).toHaveLength(0);
  });
});
