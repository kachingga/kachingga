import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApi } from '@/test/render';
import { Register } from '@/routes/register';

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn().mockResolvedValue({ error: null }),
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
});
