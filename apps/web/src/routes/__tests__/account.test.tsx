import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.palette;
  });

  it('picks the colors of the app (saved on this device)', async () => {
    const user = userEvent.setup();
    renderWithApi(<Account />, { 'profile.get': () => ({ paymentAlias: null }) });
    const group = screen.getByRole('radiogroup', { name: 'Colores de la app' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Verde' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('radio', { name: 'Azul' }));
    expect(screen.getByRole('radio', { name: 'Azul' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Verde' })).toHaveAttribute('aria-checked', 'false');
    expect(document.documentElement.dataset.palette).toBe('blue');
    expect(localStorage.getItem('kachingga-palette')).toBe('blue');
  });

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

  it('signing out deletes the offline cache saved on the device', async () => {
    localStorage.setItem('kachingga-cache:u1', '{"datos":"del grupo"}');
    localStorage.setItem('kachingga-cache-user', 'u1');
    renderWithApi(<Account />, { 'profile.get': () => ({ paymentAlias: null }) });

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(localStorage.getItem('kachingga-cache:u1')).toBeNull());
    expect(localStorage.getItem('kachingga-cache-user')).toBeNull();
  });
});
