import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Route, Routes } from 'react-router';

import { confirmEmail, useSession } from '@/lib/auth';
import { renderWithApi } from '@/test/render';
import { Login } from '@/routes/login';

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn().mockResolvedValue({ error: null }),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn(),
  resendConfirmation: vi.fn().mockResolvedValue({ error: null }),
  confirmEmail: vi.fn().mockResolvedValue({ error: null }),
  useSession: vi.fn(() => null),
  getAccessToken: vi.fn().mockResolvedValue(null),
}));
vi.mock('@marsidev/react-turnstile', () => import('@/test/fake-turnstile'));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(useSession).mockReturnValue(null);
});

const invite = '/grupos/unirme?codigo=ABCDEFGH';
const yo = { user: { email: 'yo@example.com' } } as never;
// What Supabase answers when the link confirms the email and logs in (auth-js `verifyOtp`).
const loggedInBy = (email: string) =>
  ({ data: { user: { email }, session: { user: { email } } }, error: null }) as never;

function renderLinkAt(url: string) {
  return renderWithApi(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/grupos" element={<p>Mis grupos</p>} />
      <Route path="/grupos/unirme" element={<p>Unirme al grupo</p>} />
    </Routes>,
    {},
    url,
  );
}

function authError(code: string, status = 400) {
  return { message: code, code, name: 'AuthApiError', status } as never;
}

async function logIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.type(screen.getByLabelText('Contraseña'), 'secret123');
  await user.click(screen.getByRole('button', { name: 'Dale, entremos' }));
}

describe('Login', () => {
  it('shows email and password fields', () => {
    renderWithApi(<Login />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dale, entremos' })).toBeInTheDocument();
  });

  it('shows link to register', () => {
    renderWithApi(<Login />);
    expect(screen.getByRole('link', { name: 'Creá tu cuenta' })).toBeInTheDocument();
  });

  it('links to recovering the password', () => {
    renderWithApi(<Login />);
    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute(
      'href',
      '/recuperar-contrasena',
    );
  });

  it('shows the error in Spanish when login fails', async () => {
    const { signIn } = await import('@/lib/auth');
    vi.mocked(signIn).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('invalid_credentials'),
    });

    const user = userEvent.setup();
    renderWithApi(<Login />);
    await logIn(user);

    expect(
      await screen.findByText('El email o la contraseña no son correctos.'),
    ).toBeInTheDocument();
  });

  it('never shows an unknown error as it comes', async () => {
    const { signIn } = await import('@/lib/auth');
    vi.mocked(signIn).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        message: 'Database error querying schema',
        name: 'AuthApiError',
        status: 500,
      } as never,
    });

    const user = userEvent.setup();
    renderWithApi(<Login />);
    await logIn(user);

    expect(
      await screen.findByText('Algo salió mal. Probá de nuevo en un rato.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Database error querying schema')).not.toBeInTheDocument();
  });

  it('with the email not confirmed, offers to resend the mail', async () => {
    const { signIn, resendConfirmation } = await import('@/lib/auth');
    vi.mocked(signIn).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('email_not_confirmed'),
    });

    const user = userEvent.setup();
    renderWithApi(<Login />, {}, `/login?volver=${encodeURIComponent(invite)}`);
    await logIn(user);

    expect(await screen.findByRole('heading', { name: 'Confirmá tu email' })).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reenviar mail' }));
    expect(resendConfirmation).toHaveBeenCalledWith('test@example.com', {
      returnTo: invite,
      captchaToken: undefined,
    });
    expect(await screen.findByText('Te mandamos otro mail a test@example.com')).toBeInTheDocument();
    // Supabase lets each address ask for one mail a minute.
    expect(screen.getByRole('button', { name: 'Reenviar mail (en 60 s)' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Ya lo confirmé, volver a entrar' }));
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com');
  });

  it('shows why the mail could not be resent', async () => {
    const { signIn, resendConfirmation } = await import('@/lib/auth');
    vi.mocked(signIn).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('email_not_confirmed'),
    });
    vi.mocked(resendConfirmation).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('over_email_send_rate_limit', 429),
    });

    const user = userEvent.setup();
    renderWithApi(<Login />);
    await logIn(user);
    await user.click(await screen.findByRole('button', { name: 'Reenviar mail' }));

    expect(
      await screen.findByText(
        'Mandamos muchos mails seguidos. Esperá unos minutos y probá de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar mail' })).toBeEnabled();
  });

  it("confirms the email with the mail's link and goes on to the invite", async () => {
    vi.mocked(confirmEmail).mockResolvedValueOnce(loggedInBy('nueva@example.com'));
    renderLinkAt(`/login?volver=${encodeURIComponent(invite)}#token_hash=pkce_abc`);

    expect(screen.getByRole('status')).toHaveTextContent('Confirmando tu email…');
    expect(await screen.findByText('Unirme al grupo')).toBeInTheDocument();
    expect(confirmEmail).toHaveBeenCalledWith('pkce_abc');
    // Which account it entered.
    expect(await screen.findByText('Entraste como nueva@example.com')).toBeInTheDocument();
  });

  it('with a session already open, asks before using the link', () => {
    vi.mocked(useSession).mockReturnValue(yo);
    renderLinkAt(`/login?volver=${encodeURIComponent(invite)}#token_hash=open-ask`);

    expect(screen.getByRole('heading', { name: '¿Seguís con este link?' })).toBeInTheDocument();
    expect(screen.getByText('yo@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quedarme en mi cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seguir con el link' })).toBeInTheDocument();
    expect(confirmEmail).not.toHaveBeenCalledWith('open-ask');
  });

  it('"Quedarme en mi cuenta" goes to my groups without using the link', async () => {
    vi.mocked(useSession).mockReturnValue(yo);
    const user = userEvent.setup();
    renderLinkAt(`/login?volver=${encodeURIComponent(invite)}#token_hash=open-stay`);

    await user.click(screen.getByRole('button', { name: 'Quedarme en mi cuenta' }));
    expect(await screen.findByText('Mis grupos')).toBeInTheDocument();
    expect(confirmEmail).not.toHaveBeenCalledWith('open-stay');
  });

  it('"Seguir con el link" confirms, goes on and says which account it entered', async () => {
    vi.mocked(useSession).mockReturnValue(yo);
    vi.mocked(confirmEmail).mockResolvedValueOnce(loggedInBy('otra@example.com'));
    const user = userEvent.setup();
    renderLinkAt(`/login?volver=${encodeURIComponent(invite)}#token_hash=open-proceed`);

    await user.click(screen.getByRole('button', { name: 'Seguir con el link' }));
    expect(await screen.findByText('Unirme al grupo')).toBeInTheDocument();
    expect(confirmEmail).toHaveBeenCalledWith('open-proceed');
    expect(await screen.findByText('Entraste como otra@example.com')).toBeInTheDocument();
  });

  it('does not use the link while the session is being restored', () => {
    vi.mocked(useSession).mockReturnValue(undefined);
    renderLinkAt('/login#token_hash=restoring');

    expect(screen.getByRole('status')).toHaveTextContent('Confirmando tu email…');
    expect(confirmEmail).not.toHaveBeenCalledWith('restoring');
  });

  it('goes on when already logged in (confirming the email remounts the whole app)', async () => {
    const { useSession } = await import('@/lib/auth');
    vi.mocked(useSession).mockReturnValue({} as never);
    renderWithApi(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/grupos/unirme" element={<p>Unirme al grupo</p>} />
      </Routes>,
      {},
      `/login?volver=${encodeURIComponent(invite)}`,
    );

    expect(await screen.findByText('Unirme al grupo')).toBeInTheDocument();
    vi.mocked(useSession).mockReturnValue(null);
  });

  it('says so when the confirmation link expired or was used', async () => {
    const { confirmEmail } = await import('@/lib/auth');
    vi.mocked(confirmEmail).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('otp_expired', 403),
    });
    renderWithApi(<Login />, {}, '/login#token_hash=old');

    expect(
      await screen.findByText(
        'El link para confirmar tu email venció o ya se usó. Si ya lo confirmaste, entrá con tu email y contraseña.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('offers to continue with Google', async () => {
    const { signInWithGoogle } = await import('@/lib/auth');
    const user = userEvent.setup();
    renderWithApi(<Login />);

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
    renderWithApi(<Login />);

    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(
      await screen.findByText('No se pudo entrar con Google. Probá de nuevo o usá tu email.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
  });

  it('after logging in, comes back to the invite link it was opening', async () => {
    const back = `/login?volver=${encodeURIComponent(invite)}`;
    const user = userEvent.setup();
    renderWithApi(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/grupos/unirme" element={<p>Unirme al grupo</p>} />
      </Routes>,
      {},
      back,
    );

    expect(screen.getByRole('link', { name: 'Creá tu cuenta' })).toHaveAttribute(
      'href',
      `/registro?volver=${encodeURIComponent(invite)}`,
    );
    await logIn(user);
    expect(await screen.findByText('Unirme al grupo')).toBeInTheDocument();
  });

  it('remembers the invite link before going to Google', async () => {
    const user = userEvent.setup();
    renderWithApi(<Login />, {}, `/login?volver=${encodeURIComponent('/grupos/unirme?codigo=AB')}`);
    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(sessionStorage.getItem('kachingga-volver')).toBe('/grupos/unirme?codigo=AB');
  });

  it('without a Turnstile site key there is no captcha', async () => {
    const { signIn } = await import('@/lib/auth');
    const user = userEvent.setup();
    renderWithApi(<Login />);

    expect(screen.queryByRole('button', { name: 'Resolver captcha' })).not.toBeInTheDocument();
    await logIn(user);
    expect(signIn).toHaveBeenLastCalledWith('test@example.com', 'secret123', undefined);
  });

  it('with captcha: waits for it, sends its token and asks for a new one after failing', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    const { signIn } = await import('@/lib/auth');
    vi.mocked(signIn).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('invalid_credentials'),
    });
    const user = userEvent.setup();
    renderWithApi(<Login />);

    expect(screen.getByRole('button', { name: 'Dale, entremos' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Resolver captcha' }));
    await logIn(user);

    expect(signIn).toHaveBeenLastCalledWith('test@example.com', 'secret123', 'captcha-token');
    expect(
      await screen.findByText('El email o la contraseña no son correctos.'),
    ).toBeInTheDocument();
    // Tokens are single-use: a new one before trying again.
    expect(screen.getByRole('button', { name: 'Resolver captcha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dale, entremos' })).toBeDisabled();
  });
});
