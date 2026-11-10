import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signOutOfDevice, supabase } from '@/lib/supabase';

// The tests' Supabase URL is https://test.supabase.co: this is the library's default key for it.
const SESSION_KEY = 'sb-test-auth-token';

/** A session saved on the device, as the library leaves it after logging in. */
function saveSession(refreshToken: string, { expired }: { expired: boolean }) {
  const now = Math.floor(Date.now() / 1000);
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      access_token: 'access-token',
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expired ? now - 60 : now + 3600,
      user: { id: 'u1' },
    }),
  );
}

function listenToAuth() {
  const events: string[] = [];
  const { data } = supabase.auth.onAuthStateChange((event) => {
    events.push(event);
  });
  return { events, stop: () => data.subscription.unsubscribe() };
}

// No connection: every request to Supabase fails like the browser's fetch does offline.
const offlineFetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

beforeEach(() => {
  localStorage.clear();
  offlineFetch.mockClear();
  vi.stubGlobal('fetch', offlineFetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('signOutOfDevice', () => {
  it('removes the key where the library keeps the session', async () => {
    saveSession('refresh-1', { expired: false });
    expect((await supabase.auth.getSession()).data.session?.user.id).toBe('u1');
  });

  it('offline: deletes the session without asking Supabase', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    saveSession('refresh-2', { expired: true });
    const auth = listenToAuth();

    await signOutOfDevice();

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect((await supabase.auth.getSession()).data.session).toBeNull();
    await waitFor(() => expect(auth.events).toContain('SIGNED_OUT'));
    expect(offlineFetch).not.toHaveBeenCalled();
    auth.stop();
  });

  it('offline right after opening the app with the token expired, does not wait for the library', async () => {
    vi.useFakeTimers();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    saveSession('refresh-4', { expired: true });
    // The app just opened: a new client finds the expired session and retries refreshing it ~25 s.
    vi.resetModules();
    const fresh = await import('@/lib/supabase');

    let done = false;
    void fresh.signOutOfDevice().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);

    expect(done).toBe(true);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();

    // When the library gives up, it finishes signing out and the session doesn't come back.
    const events: string[] = [];
    fresh.supabase.auth.onAuthStateChange((event) => {
      events.push(event);
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(events).toContain('SIGNED_OUT');
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect((await fresh.supabase.auth.getSession()).data.session).toBeNull();
  });

  it('when Supabase does not answer and the token expired, deletes what the library keeps', async () => {
    vi.useFakeTimers();
    saveSession('refresh-3', { expired: true });

    // The library alone (the bug): it retries refreshing the token, gives up and keeps the session.
    const library = supabase.auth.signOut();
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await library).error).not.toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();

    const auth = listenToAuth();
    const signingOut = signOutOfDevice();
    await vi.advanceTimersByTimeAsync(30_000);
    await signingOut;

    expect(offlineFetch).toHaveBeenCalled();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect((await supabase.auth.getSession()).data.session).toBeNull();
    expect(auth.events).toContain('SIGNED_OUT');
    auth.stop();
  });
});
