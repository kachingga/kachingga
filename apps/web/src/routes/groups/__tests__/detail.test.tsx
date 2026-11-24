import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { GroupDetail } from '@/routes/groups/detail';

// jsdom has no canvas: what the browser would upload
vi.mock('@/lib/photo', async (original) => ({
  ...(await original<typeof import('@/lib/photo')>()),
  photoToJpeg: vi.fn(async () => 'BASE64JPEG'),
}));
const fixGroup = {
  id: 'g1',
  name: 'Viaje a Floripa',
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
    expect(await screen.findByText('Todavía no hay gastos')).toBeInTheDocument();
    expect(screen.getByText('Agregá el primer gasto del grupo.')).toBeInTheDocument();
  });

  it('shows balances', async () => {
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
    });
    expect(await screen.findByRole('region', { name: 'Tu situación' })).toHaveTextContent(
      /Te deben/,
    );
  });

  it('on phones, opens on "Gastos", with my balance in one line that goes to "Saldos"', async () => {
    const user = userEvent.setup();
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
    });
    const line = await screen.findByRole('link', { name: /Te deben.*Ver saldos/ });
    expect(line).toHaveTextContent(/Te deben\s*\$\s?5\.000,00/);
    expect(line).toHaveAttribute('href', '/?vista=saldos');

    const tabs = screen.getByRole('navigation', { name: 'Secciones del grupo' });
    expect(within(tabs).getByRole('link', { name: 'Gastos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(within(tabs).getByRole('link', { name: 'Saldos' }));
    expect(within(tabs).getByRole('link', { name: 'Saldos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByRole('link', { name: 'Gastos' })).toHaveAttribute('href', '/');
  });

  it('opens on "Saldos" when the URL says so (e.g. back from registering a payment)', async () => {
    renderWithApi(
      <GroupDetail />,
      {
        'groups.get': () => fixGroup,
        'balances.get': () => fixBalances,
        'expenses.list': () => fixExpenses,
      },
      '/?vista=saldos',
    );
    const tabs = await screen.findByRole('navigation', { name: 'Secciones del grupo' });
    expect(within(tabs).getByRole('link', { name: 'Saldos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('my balance line has every currency I owe or am owed in, or says I am square', async () => {
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => [
        {
          currency: 'ARS',
          balances: [
            { participantId: 'p1', amountCents: 0 },
            { participantId: 'p2', amountCents: 0 },
          ],
          transfers: [],
        },
        {
          currency: 'USD',
          balances: [
            { participantId: 'p1', amountCents: -2000 },
            { participantId: 'p2', amountCents: 2000 },
          ],
          transfers: [{ fromId: 'p1', toId: 'p2', amountCents: 2000 }],
        },
      ],
      'expenses.list': () => fixExpenses,
    });
    const line = await screen.findByRole('link', { name: /Ver saldos/ });
    expect(line).toHaveTextContent(/Debés\s*US\$\s?20,00/);
    expect(line).not.toHaveTextContent('Estás al día');
  });

  it('my situation when they owe me: the amount and what it means', async () => {
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
    });
    const situation = await screen.findByRole('region', { name: 'Tu situación' });
    expect(situation).toHaveTextContent(/Te deben\s*\$\s?5\.000,00/);
    expect(situation).toHaveTextContent('Tu saldo pendiente de recibir en este grupo.');
    expect(within(situation).queryByRole('link', { name: 'Registrar pago' })).toBeNull();
  });

  it('my situation when I owe: to whom, with a shortcut to register the payment', async () => {
    const iOwe = [
      {
        currency: 'ARS',
        balances: [
          { participantId: 'p1', amountCents: -250050 },
          { participantId: 'p2', amountCents: 250050 },
        ],
        transfers: [{ fromId: 'p1', toId: 'p2', amountCents: 250050 }],
      },
    ];
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => iOwe,
      'expenses.list': () => fixExpenses,
    });
    const situation = await screen.findByRole('region', { name: 'Tu situación' });
    expect(situation).toHaveTextContent(/Debés\s*\$\s?2\.500,50/);
    expect(situation).toHaveTextContent('Pago pendiente a Tuke.');
    expect(within(situation).getByRole('link', { name: 'Registrar pago' })).toHaveAttribute(
      'href',
      '/grupos/g1/pagos?from=p1&to=p2&amount=250050&currency=ARS',
    );
  });

  it('when everyone is square: says so, without transfers', async () => {
    const square = [
      {
        currency: 'ARS',
        balances: [
          { participantId: 'p1', amountCents: 0 },
          { participantId: 'p2', amountCents: 0 },
        ],
        transfers: [],
      },
    ];
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => square,
      'expenses.list': () => fixExpenses,
    });
    const situation = await screen.findByRole('region', { name: 'Tu situación' });
    expect(situation).toHaveTextContent('Estás al día');
    expect(situation).toHaveTextContent('No tenés pagos pendientes.');
    expect(screen.getByText('Todos al día')).toBeInTheDocument();
    // Nothing to celebrate: it was already square when the screen opened.
    expect(screen.queryByText('Saldo actualizado')).not.toBeInTheDocument();
  });

  it('says "Saldo actualizado" when my balance turns square while the screen is open', async () => {
    let balances: unknown = [
      {
        currency: 'ARS',
        balances: [
          { participantId: 'p1', amountCents: -1000 },
          { participantId: 'p2', amountCents: 1000 },
        ],
        transfers: [{ fromId: 'p1', toId: 'p2', amountCents: 1000 }],
      },
    ];
    const { queryClient } = renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => balances,
      'expenses.list': () => fixExpenses,
    });
    expect(await screen.findByText('Debés')).toBeInTheDocument();

    // The payment is registered (e.g. from another screen) and the balances come back square.
    balances = [
      {
        currency: 'ARS',
        balances: [
          { participantId: 'p1', amountCents: 0 },
          { participantId: 'p2', amountCents: 0 },
        ],
        transfers: [],
      },
    ];
    await act(() => queryClient.invalidateQueries());
    expect(await screen.findByText('Saldo actualizado')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('region', { name: 'Tu situación' })).toHaveTextContent('Estás al día');
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
            category: { id: 'cat-food', name: 'Comida', icon: 'utensils', color: 'tangerine' },
            date: new Date('2024-01-15'),
            amountCents: 80000,
            currency: 'ARS',
            exchangeRate: null,
            splitType: 'EQUAL',
            paidById: 'p1',
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
      category: { id: 'cat-food', name: 'Comida', icon: 'utensils', color: 'tangerine' },
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
    // The one you just added drops in with a highlight.
    expect(screen.getByText('Pizza').closest('li')).toHaveClass('pop-in');
  });

  it('the group menu closes with Escape (focus back on "⋯") or tapping outside', async () => {
    const user = userEvent.setup();
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
    });
    const menuButton = await screen.findByRole('button', { name: 'Opciones del grupo' });
    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: 'Participantes' })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();

    await user.click(menuButton);
    expect(screen.getByRole('link', { name: 'Participantes' })).toBeInTheDocument();
    await user.click(screen.getByRole('heading', { name: 'Viaje a Floripa' }));
    expect(screen.queryByRole('link', { name: 'Participantes' })).not.toBeInTheDocument();
  });

  it("the tab's title is the group's name", async () => {
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
    });
    await screen.findByText('Viaje a Floripa');
    await waitFor(() => expect(document.title).toBe('Viaje a Floripa · Kachingga'));
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

  it('mutes and unmutes its notifications (only when the API sends them to the devices)', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    let muted = false;
    renderWithApi(<GroupDetail />, {
      'groups.get': () => ({ ...fixGroup, notificationsMuted: muted }),
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
      'notifications.pushConfig': () => ({ publicKey: 'B' + 'A'.repeat(86) }),
      'notifications.setGroupMuted': (input) => {
        calls.push(input);
        muted = (input as { muted: boolean }).muted;
        return { muted };
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Opciones del grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Silenciar notificaciones' }));
    await waitFor(() => expect(calls).toEqual([{ groupId: undefined, muted: true }]));
    expect(
      await screen.findByText(/No te van a llegar notificaciones de este grupo al dispositivo/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Opciones del grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Activar notificaciones' }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual({ groupId: undefined, muted: false });
  });

  it('without notifications on the devices, the menu has no "Silenciar"', async () => {
    const user = userEvent.setup();
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
      'notifications.pushConfig': () => ({ publicKey: null }),
    });
    await user.click(await screen.findByRole('button', { name: 'Opciones del grupo' }));
    expect(screen.getByRole('link', { name: 'Participantes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notificaciones/ })).not.toBeInTheDocument();
  });

  it('puts an emoji on the group: a usual one, another one typed, or none', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    let emoji: string | null = null;
    renderWithApi(<GroupDetail />, {
      'groups.get': () => ({ ...fixGroup, emoji }),
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
      'groups.setEmoji': (input) => {
        calls.push(input);
        emoji = (input as { emoji: string | null }).emoji;
        return { ...fixGroup, emoji };
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Opciones del grupo' }));
    await user.click(screen.getByRole('button', { name: 'Ponerle un emoji' }));
    await user.click(screen.getByRole('button', { name: 'Elegir 🏖️' }));
    await waitFor(() => expect(calls).toEqual([{ groupId: undefined, emoji: '🏖️' }]));
    // The header shows it instead of the initial, and the picker closes
    await waitFor(() => expect(screen.queryByText('Emoji del grupo')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Opciones del grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar el emoji' }));
    // Not an emoji: says so, nothing is saved
    await user.type(screen.getByLabelText('Otro'), 'hola');
    await user.click(screen.getByRole('button', { name: 'Usar' }));
    expect(screen.getByText('Escribí un solo emoji.')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    await user.clear(screen.getByLabelText('Otro'));
    await user.type(screen.getByLabelText('Otro'), '🦩');
    await user.click(screen.getByRole('button', { name: 'Usar' }));
    await waitFor(() => expect(calls[1]).toEqual({ groupId: undefined, emoji: '🦩' }));

    await user.click(screen.getByRole('button', { name: 'Opciones del grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar el emoji' }));
    await user.click(screen.getByRole('button', { name: 'Quitar el emoji' }));
    await waitFor(() => expect(calls[2]).toEqual({ groupId: undefined, emoji: null }));
  });

  it('the new emoji shows right away; if saving fails, it goes back and says so', async () => {
    const user = userEvent.setup();
    let fail = false;
    renderWithApi(<GroupDetail />, {
      'groups.get': () => ({ ...fixGroup, emoji: null }),
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
      'groups.setEmoji': async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (fail) throw apiError('El grupo está archivado');
        return { ...fixGroup, emoji: '🍕' };
      },
    });
    const heading = await screen.findByRole('heading', { name: 'Viaje a Floripa' });
    const header = heading.parentElement!.parentElement!;
    fail = true;
    await user.click(screen.getByRole('button', { name: 'Opciones del grupo' }));
    await user.click(screen.getByRole('button', { name: 'Ponerle un emoji' }));
    await user.click(screen.getByRole('button', { name: 'Elegir 🍕' }));
    expect(header).toHaveTextContent('🍕');
    expect(
      await screen.findByText(/No se cambió el emoji: El grupo está archivado/),
    ).toBeInTheDocument();
    await waitFor(() => expect(header).not.toHaveTextContent('🍕'));
  });

  it("the group's photo: any member puts it from the menu, and takes it away", async () => {
    const user = userEvent.setup();
    let photoUrl: string | null = null;
    const setGroup = vi.fn(() => ({ photoUrl: (photoUrl = 'https://fotos.test/viaje.jpg') }));
    const removeGroup = vi.fn(() => ({ photoUrl: (photoUrl = null) }));
    renderWithApi(<GroupDetail />, {
      'groups.get': () => ({ ...fixGroup, photoUrl }),
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
      'photos.config': () => ({ enabled: true }),
      'photos.setGroup': setGroup,
      'photos.removeGroup': removeGroup,
    });
    const heading = await screen.findByRole('heading', { name: 'Viaje a Floripa' });
    const header = heading.parentElement!.parentElement!;
    await user.click(screen.getByRole('button', { name: 'Opciones del grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Ponerle una foto' }));
    await user.upload(
      screen.getByTestId('photo-input'),
      new File(['x'], 'viaje.jpg', { type: 'image/jpeg' }),
    );
    await waitFor(() =>
      expect(setGroup).toHaveBeenCalledWith({ groupId: undefined, photo: 'BASE64JPEG' }),
    );
    await waitFor(() =>
      expect(header.querySelector('img')).toHaveAttribute('src', 'https://fotos.test/viaje.jpg'),
    );

    await user.click(screen.getByRole('button', { name: 'Opciones del grupo' }));
    await user.click(await screen.findByRole('button', { name: 'Sacar la foto' }));
    await waitFor(() => expect(removeGroup).toHaveBeenCalledWith({ groupId: undefined }));
    await waitFor(() => expect(header.querySelector('img')).toBeNull());
  });

  it('without photos on in the API, the menu offers none', async () => {
    const user = userEvent.setup();
    renderWithApi(<GroupDetail />, {
      'groups.get': () => fixGroup,
      'balances.get': () => fixBalances,
      'expenses.list': () => fixExpenses,
      'photos.config': () => ({ enabled: false }),
    });
    await user.click(await screen.findByRole('button', { name: 'Opciones del grupo' }));
    expect(screen.getByRole('link', { name: 'Participantes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /foto/ })).not.toBeInTheDocument();
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
    expect(await screen.findByRole('region', { name: 'Tu situación' })).toHaveTextContent(
      /Te deben/,
    );
    expect(screen.queryByRole('link', { name: 'Agregar gasto' })).not.toBeInTheDocument();
    expect(screen.queryByText('Agregá el primer gasto del grupo.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Registrar pago' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como pagado' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Opciones del grupo' }));
    expect(screen.queryByRole('button', { name: 'Renombrar grupo' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Desarchivar' }));
    await waitFor(() => expect(calls).toEqual([{ groupId: 'g1', archived: false }]));
  });
});
