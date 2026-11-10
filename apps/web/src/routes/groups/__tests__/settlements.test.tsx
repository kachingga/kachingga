import { onlineManager } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { apiError, neverResolves, renderWithApi } from '@/test/render';
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
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('shows register payment button', async () => {
    renderWithApi(<Settlements />, {
      'groups.get': () => fixGroup,
      'settlements.list': () => [],
    });
    expect(await screen.findByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
  });

  it('shows empty state when no settlements', async () => {
    renderWithApi(<Settlements />, {
      'groups.get': () => fixGroup,
      'settlements.list': () => [],
    });
    expect(await screen.findByText('Todavía no hay pagos registrados')).toBeInTheDocument();
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

  it('"Marcar como pagado" on a kept-dollar balance pays that balance in dollars', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    renderWithApi(
      <Settlements />,
      {
        'groups.get': () => fixGroup,
        'settlements.list': () => [],
        'settlements.create': (input) => {
          calls.push(input);
          return { id: 's1' };
        },
      },
      '/?from=p1&to=p2&amount=6000&currency=USD',
    );
    expect(await screen.findByLabelText('Monto')).toHaveValue('60');
    expect(screen.getByLabelText('Moneda')).toHaveValue('USD');
    await user.click(screen.getByRole('button', { name: 'Registrar' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      fromId: 'p1',
      toId: 'p2',
      amountCents: 6000,
      currency: 'USD',
      keepCurrency: true,
      exchangeRate: null,
    });
  });

  it("starts in the group's base currency", async () => {
    const user = userEvent.setup();
    renderWithApi(<Settlements />, {
      'groups.get': () => ({ ...fixGroup, baseCurrency: 'USD' }),
      'settlements.list': () => [],
    });
    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByLabelText('Moneda')).toHaveValue('USD');
  });

  it('suggests the rate for a payment in another currency', async () => {
    const user = userEvent.setup();
    renderWithApi(<Settlements />, {
      'groups.get': () => fixGroup,
      'settlements.list': () => [],
      'rates.get': () => ({
        buy: 1545,
        sell: 1565,
        mid: 1555,
        updatedAt: new Date(),
        source: 'blue',
      }),
    });
    await user.click(await screen.findByRole('button', { name: 'Registrar pago' }));
    await user.selectOptions(screen.getByLabelText('Moneda'), 'USD');
    expect(await screen.findByLabelText(/Tipo de cambio: 1 USD =/)).toHaveValue('1.555');
  });

  const fixSettlement = {
    id: 's1',
    fromId: 'p2',
    toId: 'p1',
    amountCents: 500000,
    currency: 'ARS',
    exchangeRate: null,
    date: new Date('2026-11-01T12:00:00Z'),
    note: null,
    deletedAt: null,
    groupId: 'g1',
    createdById: 'u1',
    from: { id: 'p2', name: 'Tuke' },
    to: { id: 'p1', name: 'Juan' },
  };

  it('removes a payment right away when deleting it', async () => {
    const user = userEvent.setup();
    renderWithApi(<Settlements />, {
      'groups.get': () => fixGroup,
      'settlements.list': () => [fixSettlement],
      'settlements.delete': neverResolves,
    });
    await user.click(await screen.findByRole('button', { name: 'Borrar' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Borrar' }),
    );
    await waitFor(() => expect(screen.queryByText('Tuke → Juan')).not.toBeInTheDocument());
  });

  it('shows a new payment right away and reopens the form if saving fails', async () => {
    const user = userEvent.setup();
    let reject: (e: unknown) => void = () => {};
    renderWithApi(
      <Settlements />,
      {
        'groups.get': () => fixGroup,
        'settlements.list': () => [],
        'settlements.create': () => new Promise((_, r) => (reject = r)),
      },
      '/?from=p1&to=p2&amount=6000&currency=ARS',
    );
    await user.click(await screen.findByRole('button', { name: 'Registrar' }));

    expect(await screen.findByText('Juan → Tuke')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar' })).not.toBeInTheDocument();

    reject(apiError('El grupo está archivado'));
    expect(await screen.findByRole('button', { name: 'Registrar' })).toBeInTheDocument();
    expect(screen.queryByText('Juan → Tuke')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Monto')).toHaveValue('60');
  });

  it('without connection, does not save or show the payment and says why', async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    renderWithApi(
      <Settlements />,
      {
        'groups.get': () => fixGroup,
        'settlements.list': () => [],
        'settlements.create': create,
      },
      '/?from=p1&to=p2&amount=6000&currency=ARS',
    );
    const register = await screen.findByRole('button', { name: 'Registrar' });
    onlineManager.setOnline(false);
    try {
      await user.click(register);

      expect(
        await screen.findByText('No se registró el pago: Necesitás conexión para guardar'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Juan → Tuke')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Monto')).toHaveValue('60');
      expect(create).not.toHaveBeenCalled();
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
