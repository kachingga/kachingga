import { onlineManager } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { reauthenticateWithGoogle, signIn, signOut } from '@/lib/auth';
import { apiError, neverResolves, renderWithApi, type ApiHandlers } from '@/test/render';
import { DeleteAccount } from '@/routes/delete-account';

type Provider = 'email' | 'google';
const auth = vi.hoisted(() => ({
  session: { user: { email: 'ana@example.com', identities: [{ provider: 'email' }] } } as {
    user: { email: string; identities: { provider: Provider }[] };
  },
}));
const withProviders = (...providers: Provider[]) => {
  auth.session = {
    user: { email: 'ana@example.com', identities: providers.map((provider) => ({ provider })) },
  };
};

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  reauthenticateWithGoogle: vi.fn(),
  useSession: () => auth.session,
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));
vi.mock('@marsidev/react-turnstile', () => import('@/test/fake-turnstile'));

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

function renderScreen(api: ApiHandlers, route = '/cuenta/borrar') {
  return renderWithApi(<DeleteAccount />, { 'groups.list': () => myGroups, ...api }, route);
}

async function typePasswordAndDelete(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Tu contraseña'), 'secreta123');
  await user.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }));
}

const authError = (code: string, status = 400) =>
  ({ data: {}, error: { message: code, code, name: 'AuthApiError', status } }) as never;

describe('DeleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signIn).mockResolvedValue({ data: {}, error: null } as never);
    vi.mocked(reauthenticateWithGoogle).mockResolvedValue({ data: {}, error: null } as never);
  });
  afterEach(() => {
    withProviders('email');
    vi.unstubAllEnvs();
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('what happens', () => {
    it('while it checks my balances, a skeleton and nothing to delete yet', () => {
      const { container } = renderScreen({ 'groups.list': neverResolves });
      expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Borrar mi cuenta' })).not.toBeInTheDocument();
    });

    it('my account, my name and what I leave pending in each group (archived ones too)', async () => {
      const groupsList = vi.fn(() => myGroups);
      renderScreen({ 'groups.list': groupsList });

      expect(await screen.findByText(/Vas a borrar la cuenta de/)).toHaveTextContent(
        'Vas a borrar la cuenta de ana@example.com.',
      );
      expect(groupsList).toHaveBeenCalledWith({ includeArchived: true });
      const page = document.body;
      expect(page).toHaveTextContent(
        'En tus grupos vas a seguir apareciendo como Ana, sin cuenta; tus gastos y saldos quedan. Se borran tu alias y tus filtros guardados. No se puede deshacer.',
      );
      expect(page).toHaveTextContent(/En Viaje debés \$\s?500,00: la deuda queda en el grupo\./);
      expect(page).toHaveTextContent(/En Viaje te deben US\$\s?10,00\./);
      expect(page).toHaveTextContent(/En Depto te deben \$\s?300,00\./);
      expect(page).not.toHaveTextContent('Asado'); // al día: nothing pending there
    });

    it('with a different name in some group, says so', async () => {
      renderScreen({
        'groups.list': () => [group('g1', 'Viaje', 'Ana', []), group('g2', 'Depto', 'Anita', [])],
      });
      expect(await screen.findByText(/vas a seguir apareciendo/)).toHaveTextContent(
        'vas a seguir apareciendo como Ana o Anita (según el grupo), sin cuenta',
      );
    });

    it('without groups, only what gets deleted', async () => {
      renderScreen({ 'groups.list': () => [] });
      expect(
        await screen.findByText(
          'Se borran tu alias y tus filtros guardados. No se puede deshacer.',
        ),
      ).toBeInTheDocument();
      expect(document.body).not.toHaveTextContent('vas a seguir apareciendo');
    });

    it("if my balances can't be checked, says why and doesn't let me delete", async () => {
      renderScreen({
        'groups.list': () => {
          throw apiError('Error interno. Intentá de nuevo.', 'INTERNAL_SERVER_ERROR');
        },
      });
      expect(
        await screen.findByText(
          'No se pudieron revisar tus saldos: Error interno. Intentá de nuevo.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Borrar mi cuenta' })).not.toBeInTheDocument();
    });
  });

  describe('with email and password: asks for the password again', () => {
    it('signs in again with my email and that password, then deletes, signs out leaving nothing on the device, and says so', async () => {
      localStorage.setItem('kachingga-cache:u1', '{"datos":"del grupo"}');
      localStorage.setItem('kachingga-cache-user', 'u1');
      const deleteAccount = vi.fn(() => ({ ok: true }));
      const user = userEvent.setup();
      renderScreen({ 'profile.deleteAccount': deleteAccount });

      expect(await screen.findByText('Escribí tu contraseña.')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Confirmar con Google' }),
      ).not.toBeInTheDocument();
      await typePasswordAndDelete(user);

      // findAll: Sonner keeps its toasts between tests, so the one of a previous test may still be there
      expect(await screen.findAllByText('Tu cuenta se borró')).not.toHaveLength(0);
      expect(signIn).toHaveBeenCalledWith('ana@example.com', 'secreta123', undefined);
      expect(deleteAccount).toHaveBeenCalledTimes(1);
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('kachingga-cache:u1')).toBeNull();
      expect(localStorage.getItem('kachingga-cache-user')).toBeNull();
    });

    it('a wrong password does not delete anything', async () => {
      vi.mocked(signIn).mockResolvedValueOnce(authError('invalid_credentials'));
      const deleteAccount = vi.fn(() => ({ ok: true }));
      const user = userEvent.setup();
      renderScreen({ 'profile.deleteAccount': deleteAccount });
      await typePasswordAndDelete(user);

      expect(await screen.findByText('La contraseña no es correcta.')).toBeInTheDocument();
      expect(deleteAccount).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeEnabled();
    });

    it('with the captcha on, sends its token and asks for a new one after each attempt', async () => {
      vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
      vi.mocked(signIn).mockResolvedValueOnce(authError('invalid_credentials'));
      const user = userEvent.setup();
      renderScreen({ 'profile.deleteAccount': () => ({ ok: true }) });

      expect(await screen.findByRole('button', { name: 'Borrar mi cuenta' })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Resolver captcha' }));
      await typePasswordAndDelete(user);

      expect(signIn).toHaveBeenLastCalledWith('ana@example.com', 'secreta123', 'captcha-token');
      expect(await screen.findByText('La contraseña no es correcta.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Resolver captcha' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeDisabled();
    });

    it('while it deletes, the button says so and can not be pressed again', async () => {
      const user = userEvent.setup();
      renderScreen({ 'profile.deleteAccount': neverResolves });
      await typePasswordAndDelete(user);

      expect(await screen.findByRole('button', { name: 'Borrando…' })).toBeDisabled();
      expect(signOut).not.toHaveBeenCalled();
    });

    it('if the API fails, says why and keeps me signed in', async () => {
      const user = userEvent.setup();
      renderScreen({
        'profile.deleteAccount': () => {
          throw apiError(
            'No se pudo terminar de borrar la cuenta. Intentá de nuevo.',
            'INTERNAL_SERVER_ERROR',
          );
        },
      });
      await typePasswordAndDelete(user);

      expect(
        await screen.findByText('No se pudo terminar de borrar la cuenta. Intentá de nuevo.'),
      ).toBeInTheDocument();
      expect(signOut).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Borrar mi cuenta' })).toBeEnabled();
    });

    it('offline, asks for a connection right away (without signing in)', async () => {
      const user = userEvent.setup();
      renderScreen({ 'profile.deleteAccount': () => ({ ok: true }) });
      await user.type(await screen.findByLabelText('Tu contraseña'), 'secreta123');
      onlineManager.setOnline(false);
      try {
        await user.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }));
        expect(await screen.findByText('Necesitás conexión para guardar')).toBeInTheDocument();
        expect(signIn).not.toHaveBeenCalled();
      } finally {
        onlineManager.setOnline(true);
      }
    });
  });

  describe('with Google: asks to enter with Google again', () => {
    it('only Google: no password, goes to Google and comes back to this screen', async () => {
      withProviders('google');
      const user = userEvent.setup();
      renderScreen({});

      expect(await screen.findByText('Volvé a entrar con Google.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Tu contraseña')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Confirmar con Google' }));

      expect(reauthenticateWithGoogle).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem('kachingga-volver')).toBe('/cuenta/borrar?con=google');
      expect(screen.getByRole('button', { name: 'Abriendo Google…' })).toBeDisabled();
    });

    it('email and Google: offers both', async () => {
      withProviders('email', 'google');
      renderScreen({});
      expect(
        await screen.findByText('Escribí tu contraseña o volvé a entrar con Google.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Tu contraseña')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirmar con Google' })).toBeInTheDocument();
    });

    it("if Google doesn't open, says so", async () => {
      withProviders('google');
      vi.mocked(reauthenticateWithGoogle).mockResolvedValueOnce(authError('unexpected_failure'));
      const user = userEvent.setup();
      renderScreen({});
      await user.click(await screen.findByRole('button', { name: 'Confirmar con Google' }));

      expect(
        await screen.findByText('No se pudo abrir Google. Probá de nuevo.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirmar con Google' })).toBeEnabled();
    });

    it('back from Google: deletes with one more tap, without asking again', async () => {
      withProviders('google');
      const deleteAccount = vi.fn(() => ({ ok: true }));
      const user = userEvent.setup();
      renderScreen({ 'profile.deleteAccount': deleteAccount }, '/cuenta/borrar?con=google');

      expect(await screen.findByText('Ya confirmaste con Google.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Borrar mi cuenta' }));

      // findAll: Sonner keeps its toasts between tests, so the one of a previous test may still be there
      expect(await screen.findAllByText('Tu cuenta se borró')).not.toHaveLength(0);
      expect(deleteAccount).toHaveBeenCalledTimes(1);
      expect(signIn).not.toHaveBeenCalled();
      expect(reauthenticateWithGoogle).not.toHaveBeenCalled();
    });

    it('back from Google, but too late for the API: says so and asks to confirm again', async () => {
      withProviders('google');
      const user = userEvent.setup();
      renderScreen(
        {
          'profile.deleteAccount': () => {
            throw apiError('Para borrar tu cuenta, primero confirmá que sos vos.', 'FORBIDDEN');
          },
        },
        '/cuenta/borrar?con=google',
      );
      await user.click(await screen.findByRole('button', { name: 'Borrar mi cuenta' }));

      expect(
        await screen.findByText('Para borrar tu cuenta, primero confirmá que sos vos.'),
      ).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Confirmar con Google' })).toBeEnabled();
      expect(screen.queryByText('Ya confirmaste con Google.')).not.toBeInTheDocument();
      expect(signOut).not.toHaveBeenCalled();
    });
  });
});
