import { onlineManager } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireAuth } from '@/components/require-auth';
import { rememberCachedUser } from '@/lib/offline-cache';

const auth = vi.hoisted(() => ({ session: null as unknown }));
vi.mock('@/lib/auth', () => ({ useSession: () => auth.session }));

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<p>Adentro</p>} />
        </Route>
        <Route path="/login" element={<p>Login</p>} />
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
  it('lets a session in', () => {
    auth.session = { user: { id: 'u1' } };
    renderGuarded();
    expect(screen.getByText('Adentro')).toBeInTheDocument();
  });

  it('sends to /login without a session', () => {
    rememberCachedUser('u1');
    renderGuarded();
    expect(screen.getByText('Login')).toBeInTheDocument();
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
    expect(screen.getByText('Login')).toBeInTheDocument();
  });
});
