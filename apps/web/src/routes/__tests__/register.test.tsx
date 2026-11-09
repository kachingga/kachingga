import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApi } from '@/test/render';
import { Register } from '@/routes/register';

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn().mockResolvedValue({ error: null }),
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn(),
  useSession: () => null,
  getAccessToken: vi.fn().mockResolvedValue(null),
}));

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
