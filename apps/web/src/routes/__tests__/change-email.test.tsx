import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Route, Routes } from 'react-router';

import { verifyEmailChange } from '@/lib/auth';
import { renderWithApi } from '@/test/render';
import { ChangeEmail } from '@/routes/change-email';

const auth = vi.hoisted(() => ({ session: null as unknown }));

vi.mock('@/lib/auth', () => ({
  useSession: () => auth.session,
  verifyEmailChange: vi.fn(),
}));

afterEach(() => {
  auth.session = null;
  vi.clearAllMocks();
});

// What Supabase answers to each link (auth-js `verifyOtp`).
const firstConfirmation = { data: { user: null, session: null }, error: null };
const secondConfirmation = {
  data: {
    user: { email: 'nuevo@example.com' },
    session: { access_token: 'token', user: { email: 'nuevo@example.com' } },
  },
  error: null,
};
const expired = {
  data: { user: null, session: null },
  error: { message: 'Email link is invalid or has expired', code: 'otp_expired', status: 403 },
};

function renderAt(url: string) {
  return renderWithApi(
    <Routes>
      <Route path="/cambiar-email" element={<ChangeEmail />} />
      <Route path="/cuenta" element={<p>Mi cuenta</p>} />
    </Routes>,
    {},
    url,
  );
}

describe('ChangeEmail', () => {
  it("checks the mail's link with its token", () => {
    vi.mocked(verifyEmailChange).mockReturnValueOnce(new Promise(() => {}));
    renderAt('/cambiar-email#token_hash=pkce_checking');

    expect(screen.getByRole('status')).toHaveTextContent('Revisando el link…');
    expect(verifyEmailChange).toHaveBeenCalledWith('pkce_checking');
  });

  it('first of the two links: says the other one is missing, and to log in if logged out', async () => {
    vi.mocked(verifyEmailChange).mockResolvedValueOnce(firstConfirmation as never);
    renderAt('/cambiar-email#token_hash=first-logged-out');

    expect(await screen.findByRole('heading', { name: 'Falta un paso' })).toBeInTheDocument();
    expect(screen.getByText('Listo, falta confirmar desde el otro mail.')).toBeInTheDocument();
    expect(
      screen.getByText(/tocá también el link del mail que te mandamos a la otra dirección/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
  });

  it('first of the two links, logged in: goes back to Mi cuenta', async () => {
    auth.session = { user: { email: 'juan@example.com' } };
    vi.mocked(verifyEmailChange).mockResolvedValueOnce(firstConfirmation as never);
    renderAt('/cambiar-email#token_hash=first-logged-in');

    expect(await screen.findByRole('heading', { name: 'Falta un paso' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Mi cuenta' })).toHaveAttribute('href', '/cuenta');
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('second link: the email changed (and Supabase logged in)', async () => {
    vi.mocked(verifyEmailChange).mockResolvedValueOnce(secondConfirmation as never);
    renderAt('/cambiar-email#token_hash=second');
    // Supabase's session is in this browser now.
    auth.session = secondConfirmation.data.session;

    expect(await screen.findByRole('heading', { name: '¡Listo!' })).toBeInTheDocument();
    expect(screen.getByText('nuevo@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Tu email ahora es/)).toHaveTextContent(
      'Tu email ahora es nuevo@example.com.',
    );
    expect(screen.getByRole('link', { name: 'Ir a Mi cuenta' })).toHaveAttribute('href', '/cuenta');
  });

  it('with an expired or used link, says so and how to go on (logged out: log in)', async () => {
    vi.mocked(verifyEmailChange).mockResolvedValueOnce(expired as never);
    renderAt('/cambiar-email#token_hash=expired');

    expect(
      await screen.findByRole('heading', { name: 'Este link ya no sirve' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Si ya cambiaste tu email, no hace falta nada más. Si no, pedí el cambio de nuevo desde Mi cuenta.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
  });

  it('if the exchange fails (e.g. no connection), the link is not valid either', async () => {
    vi.mocked(verifyEmailChange).mockRejectedValueOnce(new Error('offline'));
    renderAt('/cambiar-email#token_hash=throws');
    expect(
      await screen.findByRole('heading', { name: 'Este link ya no sirve' }),
    ).toBeInTheDocument();
  });

  it('without a link, goes to Mi cuenta (where the email is)', async () => {
    renderAt('/cambiar-email');
    expect(await screen.findByText('Mi cuenta')).toBeInTheDocument();
    expect(verifyEmailChange).not.toHaveBeenCalled();
  });
});
