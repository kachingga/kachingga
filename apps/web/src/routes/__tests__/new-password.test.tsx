import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Route, Routes } from 'react-router';

import { renderWithApi } from '@/test/render';
import { NewPassword } from '@/routes/new-password';

const auth = vi.hoisted(() => ({ session: null as unknown }));

vi.mock('@/lib/auth', () => ({
  useSession: () => auth.session,
  verifyPasswordReset: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updatePassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

afterEach(() => {
  auth.session = null;
});

const yo = { user: { email: 'yo@example.com' } };

function renderAt(url: string) {
  return renderWithApi(
    <Routes>
      <Route path="/nueva-contrasena" element={<NewPassword />} />
      <Route path="/grupos" element={<p>Mis grupos</p>} />
    </Routes>,
    {},
    url,
  );
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirm = password,
) {
  await user.type(screen.getByLabelText('Contraseña nueva'), password);
  await user.type(screen.getByLabelText('Confirmar contraseña'), confirm);
  await user.click(screen.getByRole('button', { name: 'Guardar y entrar' }));
}

describe('NewPassword', () => {
  it("checks the mail's link, saves the new password and goes into the app", async () => {
    const { verifyPasswordReset, updatePassword } = await import('@/lib/auth');
    const user = userEvent.setup();
    renderAt('/nueva-contrasena#token_hash=pkce_abc');

    expect(screen.getByRole('status')).toHaveTextContent('Revisando el link…');
    expect(await screen.findByLabelText('Contraseña nueva')).toBeInTheDocument();
    expect(verifyPasswordReset).toHaveBeenCalledWith('pkce_abc');

    await choose(user, 'nueva-segura-123');
    expect(updatePassword).toHaveBeenLastCalledWith('nueva-segura-123');
    expect(await screen.findByText('Mis grupos')).toBeInTheDocument();
    expect(await screen.findByText('Listo, ya tenés tu contraseña nueva')).toBeInTheDocument();
  });

  it('with an expired or used link, offers to ask for another', async () => {
    const { verifyPasswordReset } = await import('@/lib/auth');
    vi.mocked(verifyPasswordReset).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Email link is invalid or has expired', code: 'otp_expired' } as never,
    });
    renderAt('/nueva-contrasena#token_hash=old');

    expect(
      await screen.findByRole('heading', { name: 'Este link ya no sirve' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir otro link' })).toHaveAttribute(
      'href',
      '/recuperar-contrasena',
    );
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
  });

  it('without a link nor a session, the link is not valid', () => {
    auth.session = null;
    renderAt('/nueva-contrasena');
    expect(screen.getByRole('heading', { name: 'Este link ya no sirve' })).toBeInTheDocument();
  });

  it('with the session already open (link of the default template), shows the form', () => {
    auth.session = { access_token: 'token' };
    renderAt('/nueva-contrasena');
    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument();
    auth.session = null;
  });

  it('with a session already open, asks before using the link', () => {
    auth.session = yo;
    renderAt('/nueva-contrasena#token_hash=open-ask');

    expect(screen.getByRole('heading', { name: '¿Seguís con este link?' })).toBeInTheDocument();
    expect(screen.getByText('yo@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña nueva')).not.toBeInTheDocument();
  });

  it('"Quedarme en mi cuenta" goes to my groups without using the link', async () => {
    const { verifyPasswordReset } = await import('@/lib/auth');
    auth.session = yo;
    const user = userEvent.setup();
    renderAt('/nueva-contrasena#token_hash=open-stay');

    await user.click(screen.getByRole('button', { name: 'Quedarme en mi cuenta' }));
    expect(await screen.findByText('Mis grupos')).toBeInTheDocument();
    expect(verifyPasswordReset).not.toHaveBeenCalledWith('open-stay');
  });

  it('"Seguir con el link" uses it, says which account it entered and shows the form', async () => {
    const { verifyPasswordReset } = await import('@/lib/auth');
    vi.mocked(verifyPasswordReset).mockResolvedValueOnce({
      data: {
        user: { email: 'otra@example.com' },
        session: { user: { email: 'otra@example.com' } },
      },
      error: null,
    } as never);
    auth.session = yo;
    const user = userEvent.setup();
    renderAt('/nueva-contrasena#token_hash=open-proceed');

    await user.click(screen.getByRole('button', { name: 'Seguir con el link' }));
    expect(await screen.findByLabelText('Contraseña nueva')).toBeInTheDocument();
    expect(verifyPasswordReset).toHaveBeenCalledWith('open-proceed');
    expect(await screen.findByText('Entraste como otra@example.com')).toBeInTheDocument();
  });

  it('does not use the link while the session is being restored', async () => {
    const { verifyPasswordReset } = await import('@/lib/auth');
    auth.session = undefined;
    renderAt('/nueva-contrasena#token_hash=restoring');

    expect(screen.getByRole('status')).toHaveTextContent('Revisando el link…');
    expect(verifyPasswordReset).not.toHaveBeenCalledWith('restoring');
  });

  it('shows why the password was not saved', async () => {
    const { updatePassword } = await import('@/lib/auth');
    vi.mocked(updatePassword).mockResolvedValueOnce({
      data: { user: null },
      error: {
        message: 'New password should be different from the old password.',
        code: 'same_password',
        name: 'AuthApiError',
        status: 422,
      } as never,
    });
    const user = userEvent.setup();
    renderAt('/nueva-contrasena#token_hash=abc');
    await screen.findByLabelText('Contraseña nueva');

    await choose(user, 'la-de-siempre', 'otra-cosa');
    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(updatePassword).not.toHaveBeenCalledWith('la-de-siempre');

    await user.clear(screen.getByLabelText('Contraseña nueva'));
    await user.clear(screen.getByLabelText('Confirmar contraseña'));
    await choose(user, 'la-de-siempre');
    expect(
      await screen.findByText('La contraseña nueva tiene que ser distinta de la anterior.'),
    ).toBeInTheDocument();
  });
});
