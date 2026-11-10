import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Route, Routes } from 'react-router';

import { renderWithApi } from '@/test/render';
import { Register } from '@/routes/register';

const { session } = vi.hoisted(() => ({ session: { access_token: 'token' } }));

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
  // "Confirm email" off (today): Supabase logs in right away.
  signUp: vi.fn().mockResolvedValue({ data: { user: {}, session }, error: null }),
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn(),
  resendConfirmation: vi.fn().mockResolvedValue({ error: null }),
  useSession: () => null,
  getAccessToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@marsidev/react-turnstile', () => import('@/test/fake-turnstile'));

afterEach(() => vi.unstubAllEnvs());

const invite = '/grupos/unirme?codigo=ABCDEFGH';

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.type(screen.getByLabelText('Contraseña'), 'pass1234');
  await user.type(screen.getByLabelText('Confirmar contraseña'), 'pass1234');
}

describe('Register', () => {
  it('shows registration fields', () => {
    renderWithApi(<Register />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderWithApi(<Register />);

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'pass1234');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'different');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('without email confirmation, goes into the app (to the invite it was opening)', async () => {
    const { signUp } = await import('@/lib/auth');
    const user = userEvent.setup();
    renderWithApi(
      <Routes>
        <Route path="/registro" element={<Register />} />
        <Route path="/grupos/unirme" element={<p>Unirme al grupo</p>} />
      </Routes>,
      {},
      `/registro?volver=${encodeURIComponent(invite)}`,
    );

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Unirme al grupo')).toBeInTheDocument();
    expect(signUp).toHaveBeenLastCalledWith('test@example.com', 'pass1234', {
      returnTo: invite,
      captchaToken: undefined,
    });
  });

  it('with email confirmation, asks to check the mail and offers to resend it', async () => {
    const { signUp, resendConfirmation } = await import('@/lib/auth');
    vi.mocked(signUp).mockResolvedValueOnce({
      data: { user: {} as never, session: null },
      error: null,
    });
    const user = userEvent.setup();
    renderWithApi(<Register />, {}, `/registro?volver=${encodeURIComponent(invite)}`);

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByRole('heading', { name: 'Revisá tu mail' })).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    // The mail just went out: resending waits a minute (Supabase's limit per address).
    expect(screen.getByRole('button', { name: 'Reenviar mail (en 60 s)' })).toBeDisabled();
    expect(resendConfirmation).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Entrá' })).toHaveAttribute(
      'href',
      `/login?volver=${encodeURIComponent(invite)}`,
    );
  });

  it('shows the error in Spanish when the email already has an account', async () => {
    const { signUp } = await import('@/lib/auth');
    vi.mocked(signUp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        message: 'User already registered',
        code: 'user_already_exists',
        name: 'AuthApiError',
        status: 422,
      } as never,
    });
    const user = userEvent.setup();
    renderWithApi(<Register />);

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('Ya hay una cuenta con ese email. Entrá o recuperá tu contraseña.'),
    ).toBeInTheDocument();
  });

  it('with captcha: waits for it and sends its token', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    const { signUp } = await import('@/lib/auth');
    const user = userEvent.setup();
    renderWithApi(<Register />);

    await fillIn(user);
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Resolver captcha' }));
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(signUp).toHaveBeenLastCalledWith('test@example.com', 'pass1234', {
      returnTo: '/grupos',
      captchaToken: 'captcha-token',
    });
  });

  it('offers to continue with Google', async () => {
    const { signInWithGoogle } = await import('@/lib/auth');
    const user = userEvent.setup();
    renderWithApi(<Register />);

    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(signInWithGoogle).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Abriendo Google…' })).toBeDisabled();
  });

  it('shows an error when Google fails', async () => {
    const { signInWithGoogle } = await import('@/lib/auth');
    vi.mocked(signInWithGoogle).mockResolvedValueOnce({
      data: { provider: 'google', url: null },
      error: { message: 'provider is not enabled', name: 'AuthApiError', status: 400 } as never,
    });
    const user = userEvent.setup();
    renderWithApi(<Register />);

    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(
      await screen.findByText('No se pudo entrar con Google. Probá de nuevo o usá tu email.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
  });
});
