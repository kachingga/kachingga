import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApi } from '@/test/render';
import { Login } from '@/routes/login';

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn().mockResolvedValue({ error: null }),
  signUp: vi.fn(),
  signOut: vi.fn(),
  useSession: () => null,
  getAccessToken: vi.fn().mockResolvedValue(null),
}));

describe('Login', () => {
  it('shows email and password fields', () => {
    renderWithApi(<Login />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('shows link to register', () => {
    renderWithApi(<Login />);
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
  });
});
