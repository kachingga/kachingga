import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { Account } from '@/routes/account';

vi.mock('@/lib/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ user: { email: 'juan@example.com' } }),
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));

describe('Account', () => {
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
});
