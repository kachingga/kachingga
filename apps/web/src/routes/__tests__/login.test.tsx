import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Route, Routes } from 'react-router';

import { renderWithApi } from '@/test/render';
import { Login } from '@/routes/login';

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn().mockResolvedValue({ error: null }),
  signUp: vi.fn(),
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn(),
  useSession: () => null,
  getAccessToken: vi.fn().mockResolvedValue(null),
}));

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

  it('shows error when login fails', async () => {
    const { signIn } = await import('@/lib/auth');
    vi.mocked(signIn).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Credenciales inválidas', name: 'AuthApiError', status: 400 } as never,
    });

    const user = userEvent.setup();
    renderWithApi(<Login />);

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Dale, entremos' }));

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
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
    const back = `/login?volver=${encodeURIComponent('/grupos/unirme?codigo=ABCDEFGH')}`;
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
      `/registro?volver=${encodeURIComponent('/grupos/unirme?codigo=ABCDEFGH')}`,
    );
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Dale, entremos' }));
    expect(await screen.findByText('Unirme al grupo')).toBeInTheDocument();
  });

  it('remembers the invite link before going to Google', async () => {
    const user = userEvent.setup();
    renderWithApi(<Login />, {}, `/login?volver=${encodeURIComponent('/grupos/unirme?codigo=AB')}`);
    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(sessionStorage.getItem('kachingga-volver')).toBe('/grupos/unirme?codigo=AB');
  });
});
