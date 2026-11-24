import { onlineManager } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/components/app-shell';
import { Notifications } from '@/routes/notifications';
import { apiError, neverResolves, renderWithApi } from '@/test/render';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const group = { id: 'g1', name: 'Bariloche' };
const cena = {
  id: 'e1',
  description: 'Cena',
  amountCents: 4_500_000,
  currency: 'ARS',
  deletedAt: null,
  category: { icon: 'utensils', color: 'tomato' },
};

const fixtures = [
  {
    id: 'n1',
    kind: 'EXPENSE_CREATED',
    createdAt: minutesAgo(5),
    readAt: null,
    group,
    actor: { id: 'p2', name: 'Román' },
    expense: cena,
    settlement: null,
  },
  {
    id: 'n2',
    kind: 'SETTLEMENT_CREATED',
    createdAt: minutesAgo(120),
    readAt: null,
    group,
    actor: { id: 'p3', name: 'Ana' },
    expense: null,
    settlement: {
      id: 's1',
      amountCents: 2_000_000,
      currency: 'ARS',
      deletedAt: null,
      from: { id: 'p2', name: 'Román', isMe: false },
      to: { id: 'p1', name: 'Juan', isMe: true },
    },
  },
  {
    id: 'n3',
    kind: 'EXPENSE_DELETED',
    createdAt: minutesAgo(3 * 24 * 60),
    readAt: minutesAgo(60),
    group: { id: 'g2', name: 'Depto' },
    actor: null,
    expense: {
      ...cena,
      id: 'e2',
      description: 'Taxi',
      amountCents: 800_000,
      deletedAt: minutesAgo(60),
    },
    settlement: null,
  },
];

afterEach(() => onlineManager.setOnline(true));

describe('Notifications (the bell)', () => {
  it('shows a skeleton while loading', () => {
    renderWithApi(<Notifications />, { 'notifications.list': neverResolves });
    expect(screen.getByRole('heading', { name: 'Notificaciones' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('empty: explains what shows up here', async () => {
    renderWithApi(<Notifications />, { 'notifications.list': () => [] });
    expect(await screen.findByText('Todavía no hay notificaciones')).toBeInTheDocument();
    expect(screen.getByText(/en el que estás, lo vas a ver acá/)).toBeInTheDocument();
  });

  it('error: the message and "Reintentar"', async () => {
    renderWithApi(<Notifications />, {
      'notifications.list': () => {
        throw apiError('Se cayó todo');
      },
    });
    expect(await screen.findByText('Se cayó todo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('says who did what, where and when, and links to it', async () => {
    renderWithApi(<Notifications />, {
      'notifications.list': () => fixtures,
      'notifications.markAllRead': () => ({ ok: true }),
    });

    const added = await screen.findByRole('link', { name: /Román agregó «Cena»/ });
    expect(added).toHaveAttribute('href', '/grupos/g1/gastos/e1');
    expect(added).toHaveTextContent('Bariloche · hace 5 minutos');
    expect(within(added).getByText('$ 45.000,00')).toBeInTheDocument();
    expect(within(added).getByText('Sin leer')).toBeInTheDocument();

    // A payment to me says "vos" and goes to the group's payments
    const payment = screen.getByRole('link', { name: /Ana registró un pago: Román → vos/ });
    expect(payment).toHaveAttribute('href', '/grupos/g1/pagos');
    expect(payment).toHaveTextContent('Bariloche · hace 2 horas');

    // A deleted expense goes to its group; already read; whoever did it was removed from the group
    const deleted = screen.getByRole('link', { name: /Alguien borró «Taxi»/ });
    expect(deleted).toHaveAttribute('href', '/grupos/g2');
    expect(within(deleted).getByText('$ 8.000,00')).toHaveClass('line-through');
    expect(within(deleted).queryByText('Sin leer')).not.toBeInTheDocument();
  });

  it('opening it marks everything as read (and the unread count goes to 0)', async () => {
    const markAllRead = vi.fn(() => ({ ok: true }));
    const { queryClient } = renderWithApi(<Notifications />, {
      'notifications.list': () => fixtures,
      'notifications.markAllRead': markAllRead,
    });
    await waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(queryClient.getQueryData([['notifications', 'unreadCount'], { type: 'query' }])).toBe(
        0,
      ),
    );
    // What was unread stays highlighted while the screen is open
    expect(screen.getAllByText('Sin leer')).toHaveLength(2);
  });

  it("doesn't mark anything when everything is already read", async () => {
    const markAllRead = vi.fn(() => ({ ok: true }));
    renderWithApi(<Notifications />, {
      'notifications.list': () => [fixtures[2]],
      'notifications.markAllRead': markAllRead,
    });
    await screen.findByRole('link', { name: /borró «Taxi»/ });
    expect(markAllRead).not.toHaveBeenCalled();
  });

  it('without connection (what was saved on the device) it waits to be back online', async () => {
    const markAllRead = vi.fn(() => ({ ok: true }));
    onlineManager.setOnline(false);
    const { queryClient } = renderWithApi(<Notifications />, {
      'notifications.list': () => fixtures,
      'notifications.markAllRead': markAllRead,
    });
    act(() => queryClient.setQueryData([['notifications', 'list'], { type: 'query' }], fixtures));
    await screen.findByRole('link', { name: /Román agregó «Cena»/ });
    expect(markAllRead).not.toHaveBeenCalled();

    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
  });
});

describe('the bell (AppShell)', () => {
  it('shows how many are unread', async () => {
    renderWithApi(<AppShell />, { 'notifications.unreadCount': () => 3 });
    const links = await screen.findAllByRole('link', { name: 'Notificaciones: 3 sin leer' });
    // Header (phones) and sidebar (wide screens)
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/notificaciones');
  });

  it('without unread ones, just "Notificaciones"', async () => {
    renderWithApi(<AppShell />, { 'notifications.unreadCount': () => 0 });
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: 'Notificaciones' })).toHaveLength(2),
    );
    expect(screen.queryByText('9+')).not.toBeInTheDocument();
  });

  it('more than 9: "9+"', async () => {
    renderWithApi(<AppShell />, { 'notifications.unreadCount': () => 12 });
    expect(await screen.findAllByText('9+')).toHaveLength(2);
  });
});
