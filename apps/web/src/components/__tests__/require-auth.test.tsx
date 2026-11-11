import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
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

  it('when Google comes back with an error instead of the session, sends to /login with the reason', () => {
    renderGuarded(
      '/?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance',
    );
    expect(screen.getByText('Login?google=signup_disabled')).toBeInTheDocument();
  });

  it('a Google error without a code sends the error', () => {
    renderGuarded('/?error=access_denied&error_description=denied');
    expect(screen.getByText('Login?google=access_denied')).toBeInTheDocument();
  });

  it('with a session, an error in the URL does not matter', () => {
    auth.session = { user: { id: 'u1' } };
    renderGuarded('/?error=access_denied&error_code=signup_disabled');
    expect(screen.getByText('Adentro')).toBeInTheDocument();
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

  describe('while the session is being restored', () => {
    beforeEach(() => {
      auth.session = undefined;
    });

    it('offline with the last user cache saved, opens the app (read-only) right away', () => {
      rememberCachedUser('u1');
      onlineManager.setOnline(false);
      renderGuarded();
      expect(screen.getByText('Adentro')).toBeInTheDocument();
    });

    it('online, shows the splash even with a saved cache', () => {
      rememberCachedUser('u1');
      renderGuarded();
      expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
      expect(screen.queryByText('Adentro')).not.toBeInTheDocument();
    });

    it('offline with nothing saved, shows the splash', () => {
      onlineManager.setOnline(false);
      renderGuarded();
      expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
      expect(screen.queryByText(/Login/)).not.toBeInTheDocument();
    });

    it('back online before it is restored, waits for it (splash)', () => {
      rememberCachedUser('u1');
      onlineManager.setOnline(false);
      renderGuarded();
      expect(screen.getByText('Adentro')).toBeInTheDocument();

      act(() => onlineManager.setOnline(true));
      expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
      expect(screen.queryByText('Adentro')).not.toBeInTheDocument();
    });
  });
});
