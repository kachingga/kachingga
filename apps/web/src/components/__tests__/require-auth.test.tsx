import { onlineManager } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireAuth } from '@/components/require-auth';
import { rememberCachedUser } from '@/lib/offline-cache';

const auth = vi.hoisted(() => ({ session: null as unknown }));
vi.mock('@/lib/auth', () => ({ useSession: () => auth.session }));

function LoginStub() {
  const { search } = useLocation();
  return <p>Login{search}</p>;
}

function renderGuarded(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<p>Adentro</p>} />
          <Route path="/grupos/unirme" element={<p>Unirme</p>} />
        </Route>
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  auth.session = null;
});
afterEach(() => onlineManager.setOnline(true));

describe('RequireAuth', () => {
  it('while the session is being restored, shows the splash (not /login)', () => {
    auth.session = undefined;
    renderGuarded();
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
    expect(screen.queryByText(/Login/)).not.toBeInTheDocument();
    expect(screen.queryByText('Adentro')).not.toBeInTheDocument();
  });

  it('lets a session in', () => {
    auth.session = { user: { id: 'u1' } };
    renderGuarded();
    expect(screen.getByText('Adentro')).toBeInTheDocument();
  });

  it('sends to /login without a session', () => {
    rememberCachedUser('u1');
    renderGuarded();
    expect(screen.getByText(/^Login/)).toBeInTheDocument();
  });

  it('without a session, remembers the page it was opening (an invite link) to come back after login', () => {
    renderGuarded('/grupos/unirme?codigo=ABCDEFGH');
    expect(
      screen.getByText(`Login?volver=${encodeURIComponent('/grupos/unirme?codigo=ABCDEFGH')}`),
    ).toBeInTheDocument();
  });

  it('offline with the last user cache saved, opens the app (read-only) without a session', () => {
    rememberCachedUser('u1');
    onlineManager.setOnline(false);
    renderGuarded();
    expect(screen.getByText('Adentro')).toBeInTheDocument();
  });

  it('offline with nothing saved, sends to /login', () => {
    onlineManager.setOnline(false);
    renderGuarded();
    expect(screen.getByText(/^Login/)).toBeInTheDocument();
  });
});
