import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { refreshSession, requestEmailChange } from '@/lib/auth';
import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { Account } from '@/routes/account';

const auth = vi.hoisted(() => ({
  session: { user: { email: 'juan@example.com' } } as {
    user: { email: string; new_email?: string };
  },
}));

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  requestEmailChange: vi.fn(),
  refreshSession: vi.fn(),
  useSession: () => auth.session,
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

  describe('Cambiar email', () => {
    function authError(code: string, status: number) {
      return { data: { user: null }, error: { message: code, code, name: 'AuthApiError', status } };
    }

    beforeEach(() => vi.clearAllMocks());
    afterEach(() => {
      auth.session = { user: { email: 'juan@example.com' } };
    });

    async function openForm() {
      const user = userEvent.setup();
      renderWithApi(<Account />, { 'profile.get': () => ({ paymentAlias: null }) });
      await user.click(screen.getByRole('button', { name: 'Cambiar email' }));
      return user;
    }

    async function submit(user: ReturnType<typeof userEvent.setup>, email: string) {
      await user.type(screen.getByLabelText('Email nuevo'), email);
      await user.click(screen.getByRole('button', { name: 'Cambiar email' }));
    }

    it('asks for the new email, explaining the two mails, and can be cancelled', async () => {
      const user = await openForm();
      expect(screen.getByLabelText('Email nuevo')).toHaveValue('');
      expect(
        screen.getByText(
          'Te vamos a mandar un mail a tu email actual y otro al nuevo: el cambio se hace cuando confirmes desde los dos.',
        ),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByLabelText('Email nuevo')).not.toBeInTheDocument();
      expect(screen.getByText('juan@example.com')).toBeInTheDocument();
    });

    it('sends the mails to both addresses and says so', async () => {
      vi.mocked(requestEmailChange).mockResolvedValueOnce({
        data: { user: { email: 'juan@example.com', new_email: 'nuevo@example.com' } },
        error: null,
      } as never);
      const user = await openForm();
      await submit(user, '  Nuevo@Example.com ');

      expect(requestEmailChange).toHaveBeenCalledWith('Nuevo@Example.com');
      expect(
        await screen.findByText(/confirmá desde los dos para que se haga el cambio/),
      ).toHaveTextContent(
        'Te mandamos un mail a juan@example.com y otro a nuevo@example.com: confirmá desde los dos para que se haga el cambio.',
      );
      expect(screen.queryByLabelText('Email nuevo')).not.toBeInTheDocument();
    });

    it('while it sends, the button says so and can not be pressed again', async () => {
      vi.mocked(requestEmailChange).mockReturnValueOnce(new Promise(() => {}));
      const user = await openForm();
      await submit(user, 'nuevo@example.com');

      expect(await screen.findByRole('button', { name: 'Enviando…' })).toBeDisabled();
      expect(requestEmailChange).toHaveBeenCalledTimes(1);
    });

    it('checks the format and that it is a different email before sending', async () => {
      const user = await openForm();
      await submit(user, 'no-es-un-mail');
      expect(await screen.findByText('Ese email no es válido.')).toBeInTheDocument();

      await user.clear(screen.getByLabelText('Email nuevo'));
      await submit(user, 'JUAN@example.com');
      expect(await screen.findByText('Ese ya es tu email.')).toBeInTheDocument();

      await user.clear(screen.getByLabelText('Email nuevo'));
      await user.click(screen.getByRole('button', { name: 'Cambiar email' }));
      expect(await screen.findByText('Ese email no es válido.')).toBeInTheDocument();

      expect(requestEmailChange).not.toHaveBeenCalled();
    });

    it('shows in Spanish why it could not be changed', async () => {
      vi.mocked(requestEmailChange)
        .mockResolvedValueOnce(authError('email_exists', 422) as never)
        .mockResolvedValueOnce(authError('over_email_send_rate_limit', 429) as never);
      const user = await openForm();

      await submit(user, 'de-otro@example.com');
      expect(await screen.findByText('Ya hay otra cuenta con ese email.')).toBeInTheDocument();

      await user.clear(screen.getByLabelText('Email nuevo'));
      await submit(user, 'nuevo@example.com');
      expect(
        await screen.findByText(
          'Mandamos muchos mails seguidos. Esperá unos minutos y probá de nuevo.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Email nuevo')).toBeInTheDocument();
    });

    it('with a change pending, says so and asks Supabase whether it already happened', () => {
      auth.session = { user: { email: 'juan@example.com', new_email: 'nuevo@example.com' } };
      renderWithApi(<Account />, { 'profile.get': () => ({ paymentAlias: null }) });

      expect(screen.getByText(/confirmá desde los dos/)).toHaveTextContent(
        'Te mandamos un mail a juan@example.com y otro a nuevo@example.com',
      );
      expect(refreshSession).toHaveBeenCalledTimes(1);
    });

    it('without a change pending, does not ask Supabase again', () => {
      renderWithApi(<Account />, { 'profile.get': () => ({ paymentAlias: null }) });
      expect(screen.queryByText(/confirmá desde los dos/)).not.toBeInTheDocument();
      expect(refreshSession).not.toHaveBeenCalled();
    });
  });

  it('"Borrar mi cuenta" goes to the screen that asks to confirm it is you', () => {
    renderWithApi(<Account />, { 'profile.get': () => ({ paymentAlias: null }) });
    expect(screen.getByRole('link', { name: 'Borrar mi cuenta' })).toHaveAttribute(
      'href',
      '/cuenta/borrar',
    );
  });
});
