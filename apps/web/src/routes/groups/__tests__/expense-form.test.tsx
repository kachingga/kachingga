import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router';

import { dayToDate, today } from '@/lib/format';

import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { ExpenseForm } from '@/routes/groups/expense-form';

const fixGroup = {
  id: 'g1',
  name: 'Viaje',
  baseCurrency: 'ARS',
  inviteCode: 'ABC12345',
  archivedAt: null,
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

  it('offers the group\'s active categories ("Otros" by default) and sends the one picked', async () => {
    const user = userEvent.setup();
    const create = captureCreate();
    const category = (id: string, name: string, defaultKey: string | null, archived = false) => ({
      id,
      name,
      icon: 'shapes',
      color: 'cocoa',
      defaultKey,
      archived,
      expenseCount: 0,
    });
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => fixGroup,
      'categories.list': () => [
        category('c-food', 'Comida', 'FOOD'),
        category('c-old', 'Vieja', null, true),
        category('c-nafta', 'Nafta', null),
        category('c-other', 'Otros', 'OTHER'),
      ],
      'expenses.create': create.handler,
    });
    const picker = await screen.findByRole('radiogroup', { name: 'Categoría' });
    // Active ones only (the archived "Vieja" is left out), "Otros" picked by default.
    expect(
      within(picker)
        .getAllByRole('radio')
        .map((o) => o.textContent),
    ).toEqual(['Comida', 'Nafta', 'Otros']);
    expect(within(picker).getByRole('radio', { name: 'Otros' })).toBeChecked();
    expect(screen.getByRole('link', { name: 'Editar categorías' })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/categorias$/),
    );

    await fillBasics(user, '100');
    await user.click(within(picker).getByRole('radio', { name: 'Nafta' }));
    expect(within(picker).getByRole('radio', { name: 'Nafta' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Agregar gasto' }));
    await waitFor(() => expect(create.calls).toHaveLength(1));
    expect(create.calls[0]).toMatchObject({ categoryId: 'c-nafta' });
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
    expect(await screen.findByDisplayValue('1.555')).toBeInTheDocument();
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
    expect(await screen.findByLabelText(/Tipo de cambio: 1 USD =/)).toHaveValue('1.555');
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

describe('ExpenseForm (equal split preview)', () => {
  it('shows the same cents as the API: $4 among 3 is 1,34 / 1,33 / 1,33', async () => {
    const user = userEvent.setup();
    const third = { ...fixGroup.participants[1]!, id: 'p3', name: 'Román' };
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => ({ ...fixGroup, participants: [...fixGroup.participants, third] }),
    });
    await user.type(await screen.findByLabelText('Monto'), '4');

    expect(screen.getByText('$ 1,34')).toBeInTheDocument();
    expect(screen.getAllByText('$ 1,33')).toHaveLength(2);
  });
});

describe('ExpenseForm (optimistic save)', () => {
  it('if saving fails, a toast offers to reopen the form with what was entered', async () => {
    const user = userEvent.setup();
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => fixGroup,
      'expenses.create': () => {
        throw apiError('Se cayó la conexión');
      },
    });
    await user.type(await screen.findByLabelText('Monto'), '1500');
    await user.type(screen.getByLabelText('Descripción'), 'Cena');
    await user.click(screen.getByRole('button', { name: 'Agregar gasto' }));

    expect(await screen.findByText('No se guardó "Cena": Se cayó la conexión')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Descripción'));
    await user.click(screen.getByRole('button', { name: 'Revisar' }));

    expect(await screen.findByDisplayValue('Cena')).toBeInTheDocument();
    expect(screen.getByLabelText('Monto')).toHaveValue('1.500');
  });

  it("doesn't save a split by amount that doesn't add up", async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => fixGroup,
      'expenses.create': (input) => calls.push(input),
    });
    await user.type(await screen.findByLabelText('Monto'), '100');
    await user.type(screen.getByLabelText('Descripción'), 'Cena');
    await user.click(screen.getByRole('button', { name: 'Por monto' }));
    await user.type(screen.getByLabelText('Monto de Juan'), '60');
    await user.click(screen.getByRole('button', { name: 'Agregar gasto' }));

    expect(
      await screen.findByText('La suma de los montos no coincide con el total'),
    ).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe('ExpenseForm (automatic category)', () => {
  const category = (id: string, name: string, defaultKey: string | null) => ({
    id,
    name,
    icon: 'shapes',
    color: 'cocoa',
    defaultKey,
    archived: false,
    expenseCount: 0,
  });
  const categories = () => [
    category('c-food', 'Comida', 'FOOD'),
    category('c-groceries', 'Súper', 'GROCERIES'),
    category('c-nafta', 'Nafta', null),
    category('c-other', 'Otros', 'OTHER'),
  ];
  // Fake suggestion: "Coto" → Súper, "Uber" → Nafta (a custom one), anything else → nothing.
  function fakeSuggest() {
    const calls: string[] = [];
    return {
      calls,
      handler: (input: unknown) => {
        const { description } = input as { description: string };
        calls.push(description);
        if (/coto/i.test(description)) return { categoryId: 'c-groceries', source: 'keyword' };
        if (/uber/i.test(description)) return { categoryId: 'c-nafta', source: 'history' };
        return null;
      },
    };
  }

  it('picks the suggested category while typing (once it stops) and marks it as suggested', async () => {
    const user = userEvent.setup();
    const suggest = fakeSuggest();
    const created: Record<string, unknown>[] = [];
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => fixGroup,
      'categories.list': categories,
      'categories.suggest': suggest.handler,
      'expenses.create': (input) => {
        created.push(input as Record<string, unknown>);
        return { id: 'e1' };
      },
    });
    const picker = await screen.findByRole('radiogroup', { name: 'Categoría' });
    expect(screen.queryByText('Sugerida')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Monto'), '100');
    await user.type(screen.getByLabelText('Descripción'), 'Coto');
    await waitFor(() => expect(within(picker).getByRole('radio', { name: 'Súper' })).toBeChecked());
    expect(screen.getByText('Sugerida')).toBeInTheDocument();
    // Debounced: asked once, for the whole word, not on every keystroke.
    expect(suggest.calls).toEqual(['Coto']);

    await user.click(screen.getByRole('button', { name: 'Agregar gasto' }));
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({ categoryId: 'c-groceries' });
  });

  it('follows the description, and goes back to "Otros" when nothing matches', async () => {
    const user = userEvent.setup();
    const suggest = fakeSuggest();
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => fixGroup,
      'categories.list': categories,
      'categories.suggest': suggest.handler,
    });
    const picker = await screen.findByRole('radiogroup', { name: 'Categoría' });
    const description = screen.getByLabelText('Descripción');
    await user.type(description, 'Uber');
    await waitFor(() => expect(within(picker).getByRole('radio', { name: 'Nafta' })).toBeChecked());
    await user.clear(description);
    await user.type(description, 'Varios');
    await waitFor(() => expect(suggest.calls).toContain('Varios'));
    await waitFor(() => expect(within(picker).getByRole('radio', { name: 'Otros' })).toBeChecked());
    expect(screen.queryByText('Sugerida')).not.toBeInTheDocument();
  });

  it('never replaces a category picked by hand (before or after the suggestion)', async () => {
    const user = userEvent.setup();
    const suggest = fakeSuggest();
    renderWithApi(<ExpenseForm />, {
      'groups.get': () => fixGroup,
      'categories.list': categories,
      'categories.suggest': suggest.handler,
    });
    const picker = await screen.findByRole('radiogroup', { name: 'Categoría' });
    const description = screen.getByLabelText('Descripción');

    // Suggested, then changed by hand: it stays, whatever is typed next.
    await user.type(description, 'Coto');
    await waitFor(() => expect(within(picker).getByRole('radio', { name: 'Súper' })).toBeChecked());
    await user.click(within(picker).getByRole('radio', { name: 'Comida' }));
    expect(screen.queryByText('Sugerida')).not.toBeInTheDocument();
    await user.clear(description);
    await user.type(description, 'Uber');
    await new Promise((r) => setTimeout(r, 600));
    expect(within(picker).getByRole('radio', { name: 'Comida' })).toBeChecked();
    expect(suggest.calls).toEqual(['Coto']);
  });

  it('editing an expense keeps its category (no suggestion)', async () => {
    const user = userEvent.setup();
    const suggest = fakeSuggest();
    const expense = {
      id: 'e1',
      description: 'Cena',
      categoryId: 'c-food',
      category: { id: 'c-food', name: 'Comida', icon: 'shapes', color: 'cocoa' },
      date: new Date('2026-11-01T12:00:00Z'),
      amountCents: 1000,
      currency: 'ARS',
      exchangeRate: null,
      splitType: 'EQUAL',
      paidById: 'p1',
      deletedAt: null,
      groupId: 'g1',
      paidBy: { id: 'p1', name: 'Juan' },
      splits: [{ expenseId: 'e1', participantId: 'p1', amountCents: 1000, percentage: null }],
    };
    renderWithApi(
      <Routes>
        <Route path="/grupos/:groupId/gastos/:expenseId/editar" element={<ExpenseForm />} />
      </Routes>,
      {
        'groups.get': () => fixGroup,
        'expenses.get': () => expense,
        'categories.list': categories,
        'categories.suggest': suggest.handler,
      },
      '/grupos/g1/gastos/e1/editar',
    );
    const picker = await screen.findByRole('radiogroup', { name: 'Categoría' });
    expect(within(picker).getByRole('radio', { name: 'Comida' })).toBeChecked();
    const description = screen.getByLabelText('Descripción');
    await user.clear(description);
    await user.type(description, 'Coto');
    await new Promise((r) => setTimeout(r, 600));
    expect(within(picker).getByRole('radio', { name: 'Comida' })).toBeChecked();
    expect(suggest.calls).toEqual([]);
  });
});
