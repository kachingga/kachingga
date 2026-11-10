import { onlineManager } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signOut } from '@/lib/auth';
import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { Account } from '@/routes/account';

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ user: { email: 'juan@example.com' } }),
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));

describe('Account', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.palette;
  });

  it('picks the colors of the app (saved on this device)', async () => {
    const user = userEvent.setup();
    renderWithApi(<Account />, { 'profile.get': () => ({ paymentAlias: null }) });
    const group = screen.getByRole('radiogroup', { name: 'Colores de la app' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Verde' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: 'Azul' }));
    expect(screen.getByRole('radio', { name: 'Azul' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Verde' })).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.dataset.palette).toBe('blue');
    expect(localStorage.getItem('kachingga-palette')).toBe('blue');
  });

  it('shows loading state for profile', () => {
    renderWithApi(<Account />, { 'profile.get': neverResolves });
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('shows alias when profile loads', async () => {
    renderWithApi(<Account />, {
      'profile.get': () => ({ paymentAlias: 'mi.alias' }),
    });
    expect(await screen.findByText('mi.alias')).toBeInTheDocument();
  });

  it('shows "Sin alias" when no alias is set', async () => {
    renderWithApi(<Account />, {
      'profile.get': () => ({ paymentAlias: null }),
    });
    expect(await screen.findByText('Sin alias')).toBeInTheDocument();
  });

  it('shows email from session', () => {
    renderWithApi(<Account />, { 'profile.get': neverResolves });
    expect(screen.getByText('juan@example.com')).toBeInTheDocument();
  });

  it('shows error state', async () => {
    renderWithApi(<Account />, {
      'profile.get': () => {
        throw apiError('No autorizado', 'UNAUTHORIZED');
      },
    });
    expect(await screen.findByText('No autorizado')).toBeInTheDocument();
  });

  it('signing out deletes the offline cache saved on the device', async () => {
    localStorage.setItem('kachingga-cache:u1', '{"datos":"del grupo"}');
    localStorage.setItem('kachingga-cache-user', 'u1');
    renderWithApi(<Account />, { 'profile.get': () => ({ paymentAlias: null }) });

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(localStorage.getItem('kachingga-cache:u1')).toBeNull());
    expect(localStorage.getItem('kachingga-cache-user')).toBeNull();
  });

  describe('Borrar mi cuenta', () => {
    const group = (id: string, name: string, myName: string, myBalances: unknown[]) => ({
      id,
      name,
      baseCurrency: 'ARS',
      archivedAt: null,
      _count: { participants: 2 },
      participants: [],
      myName,
      myBalanceCents: 0,
      myBalances,
    });
    const myGroups = [
      group('g1', 'Viaje', 'Ana', [
        { currency: 'ARS', amountCents: -50000 },
        { currency: 'USD', amountCents: 1000 },
      ]),
      group('g2', 'Depto', 'Ana', [{ currency: 'ARS', amountCents: 30000 }]),
      group('g3', 'Asado', 'Ana', []),
    ];

    beforeEach(() => vi.clearAllMocks());

    async function openConfirm(api: Parameters<typeof renderWithApi>[1]) {
      renderWithApi(<Account />, { 'profile.get': () => ({ paymentAlias: null }), ...api });
      await userEvent.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }));
      return screen.findByRole('alertdialog');
    }

    it('asks first, with my name and what I leave pending in each group (archived ones too)', async () => {
      const groupsList = vi.fn(() => myGroups);
      const deleteAccount = vi.fn(() => ({ ok: true }));
      const dialog = await openConfirm({
        'groups.list': groupsList,
        'profile.deleteAccount': deleteAccount,
      });

      expect(groupsList).toHaveBeenCalledWith({ includeArchived: true });
      expect(within(dialog).getByText('¿Borrar tu cuenta?')).toBeInTheDocument();
      expect(dialog).toHaveTextContent(
        'En tus grupos vas a seguir apareciendo como Ana, sin cuenta; tus gastos y saldos quedan. Se borran tu alias y tus filtros guardados. No se puede deshacer.',
      );
      expect(dialog).toHaveTextContent(/En Viaje debés \$\s?500,00: la deuda queda en el grupo\./);
      expect(dialog).toHaveTextContent(/En Viaje te deben US\$\s?10,00\./);
      expect(dialog).toHaveTextContent(/En Depto te deben \$\s?300,00\./);
      expect(dialog).not.toHaveTextContent('Asado'); // al día: nothing pending there

      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it('with a different name in some group, says so', async () => {
      const dialog = await openConfirm({
        'groups.list': () => [group('g1', 'Viaje', 'Ana', []), group('g2', 'Depto', 'Anita', [])],
      });
      expect(dialog).toHaveTextContent(
        'vas a seguir apareciendo como Ana o Anita (según el grupo), sin cuenta',
      );
    });

    it('without groups, only what gets deleted', async () => {
      const dialog = await openConfirm({ 'groups.list': () => [] });
      expect(dialog).toHaveTextContent(
        'Se borran tu alias y tus filtros guardados. No se puede deshacer.',
      );
      expect(dialog).not.toHaveTextContent('vas a seguir apareciendo');
    });

    it('confirming deletes it, signs out leaving nothing on the device, and says so', async () => {
      localStorage.setItem('kachingga-cache:u1', '{"datos":"del grupo"}');
      localStorage.setItem('kachingga-cache-user', 'u1');
      const deleteAccount = vi.fn(() => ({ ok: true }));
      const dialog = await openConfirm({
        'groups.list': () => myGroups,
        'profile.deleteAccount': deleteAccount,
      });

      await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar mi cuenta' }));

      expect(await screen.findByText('Tu cuenta se borró')).toBeInTheDocument();
      expect(deleteAccount).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('kachingga-cache:u1')).toBeNull();
      expect(localStorage.getItem('kachingga-cache-user')).toBeNull();
    });

    it('while it deletes, the button says so and can not be pressed again', async () => {
      const dialog = await openConfirm({
        'groups.list': () => myGroups,
        'profile.deleteAccount': neverResolves,
      });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar mi cuenta' }));

      const button = await screen.findByRole('button', { name: 'Borrando…' });
      expect(button).toBeDisabled();
      expect(signOut).not.toHaveBeenCalled();
    });

    it('while it checks my balances, the button is busy', async () => {
      renderWithApi(<Account />, {
        'profile.get': () => ({ paymentAlias: null }),
        'groups.list': neverResolves,
      });
      const button = screen.getByRole('button', { name: 'Borrar mi cuenta' });
      await userEvent.click(button);
      expect(button).toBeDisabled();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('if it fails, says why and keeps me signed in', async () => {
      const dialog = await openConfirm({
        'groups.list': () => myGroups,
        'profile.deleteAccount': () => {
          throw apiError(
            'No se pudo terminar de borrar la cuenta. Intentá de nuevo.',
            'INTERNAL_SERVER_ERROR',
          );
        },
      });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Borrar mi cuenta' }));

      expect(
        await screen.findByText('No se pudo terminar de borrar la cuenta. Intentá de nuevo.'),
      ).toBeInTheDocument();
      expect(signOut).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeEnabled();
    });

    it("if my balances can't be checked, doesn't ask (nor delete)", async () => {
      const deleteAccount = vi.fn(() => ({ ok: true }));
      renderWithApi(<Account />, {
        'profile.get': () => ({ paymentAlias: null }),
        'groups.list': () => {
          throw apiError('Error interno. Intentá de nuevo.', 'INTERNAL_SERVER_ERROR');
        },
        'profile.deleteAccount': deleteAccount,
      });
      await userEvent.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }));

      expect(
        await screen.findByText(
          'No se pudieron revisar tus saldos: Error interno. Intentá de nuevo.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it('offline, asks for a connection right away', async () => {
      const groupsList = vi.fn(() => myGroups);
      renderWithApi(<Account />, {
        'profile.get': () => ({ paymentAlias: null }),
        'groups.list': groupsList,
      });
      onlineManager.setOnline(false);
      try {
        await userEvent.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }));
        expect(await screen.findByText('Necesitás conexión para guardar')).toBeInTheDocument();
        expect(groupsList).not.toHaveBeenCalled();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      } finally {
        onlineManager.setOnline(true);
      }
    });
  });
});
