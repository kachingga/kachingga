import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { useEmailLink, useEmailLinkResult } from '@/lib/email-link';

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

type Session = Parameters<typeof useEmailLink>[1];
const loggedIn = { user: { email: 'yo@example.com' } } as Session;

function Screen({
  verify,
  session,
}: {
  verify: Parameters<typeof useEmailLink>[0];
  session: Session;
}) {
  const { status, proceed, stay } = useEmailLink(verify, session);
  const location = useLocation();
  return (
    <>
      <p>{status}</p>
      <p>{location.pathname + location.hash}</p>
      <button onClick={proceed}>Seguir</button>
      <button onClick={stay}>Quedarme</button>
    </>
  );
}

// `session` undefined: still being restored.
const at = (route: string, verify: Parameters<typeof useEmailLink>[0], session: Session) => (
  <MemoryRouter initialEntries={[route]}>
    <Screen verify={verify} session={session} />
  </MemoryRouter>
);

describe('useEmailLink', () => {
  it('is "none" without a token in the URL', () => {
    const verify = vi.fn();
    render(at('/login', verify, null));
    expect(screen.getByText('none')).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it('exchanges the token once even if the screen mounts again before it finishes', async () => {
    let finish!: () => void;
    const verify = vi.fn(
      () => new Promise<{ error: null }>((resolve) => (finish = () => resolve({ error: null }))),
    );
    // Logging in remounts the whole app (ApiProvider): the second mount still has the token.
    const first = render(at('/login#token_hash=remount', verify, null));
    expect(screen.getByText('verifying')).toBeInTheDocument();
    first.unmount();
    render(at('/login#token_hash=remount', verify, null));
    finish();

    expect(await screen.findByText('verified')).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('takes the token out of the URL and a screen mounted again still gets the answer', async () => {
    const verify = vi.fn(async () => ({
      error: null,
      data: { session: { user: { email: 'nuevo@example.com' } } },
    }));
    function Result() {
      const { status, result } = useEmailLinkResult(verify, null);
      const location = useLocation();
      return (
        <p>
          {status} {result?.data.session.user.email} {location.hash || 'sin-hash'}
        </p>
      );
    }
    // The remount happens inside the same router (the app's), as when logging in.
    const app = (key: string) => (
      <MemoryRouter initialEntries={['/cambiar-email#token_hash=out-of-url']}>
        <Result key={key} />
      </MemoryRouter>
    );
    const { rerender } = render(app('before'));
    expect(await screen.findByText('verified nuevo@example.com sin-hash')).toBeInTheDocument();

    rerender(app('after-login'));
    expect(await screen.findByText('verified nuevo@example.com sin-hash')).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
    // The account it logged in to, said once (not once per mount).
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith('Entraste como nuevo@example.com');
  });

  it('after a reload, the token kept in the history is not tried again', () => {
    const verify = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/cambiar-email', state: { emailLink: 'used' } }]}>
        <Screen verify={verify} session={null} />
      </MemoryRouter>,
    );
    expect(screen.getByText('none')).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it('an expired link is "invalid" and stays in the URL', async () => {
    const verify = vi.fn().mockResolvedValue({ error: { code: 'otp_expired' } });
    render(at('/login#token_hash=expired', verify, null));
    expect(await screen.findByText('invalid')).toBeInTheDocument();
    expect(screen.getByText('/login#token_hash=expired')).toBeInTheDocument();
  });

  it('with a session open, asks and only uses the link if the person chooses to', async () => {
    const verify = vi.fn().mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(at('/login#token_hash=ask-proceed', verify, loggedIn));

    expect(screen.getByText('ask')).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(await screen.findByText('verified')).toBeInTheDocument();
    expect(verify).toHaveBeenCalledWith('ask-proceed');
  });

  it('staying in the account goes home and drops the token, without using it', async () => {
    const verify = vi.fn();
    const user = userEvent.setup();
    render(at('/nueva-contrasena#token_hash=ask-stay', verify, loggedIn));

    await user.click(screen.getByRole('button', { name: 'Quedarme' }));
    expect(await screen.findByText('/grupos')).toBeInTheDocument();
    expect(screen.getByText('none')).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it('waits while the session is being restored', async () => {
    const verify = vi.fn().mockResolvedValue({ error: null });
    const { rerender } = render(at('/login#token_hash=restoring-out', verify, undefined));
    expect(screen.getByText('verifying')).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();

    // Logged out: it's used as always.
    rerender(at('/login#token_hash=restoring-out', verify, null));
    expect(await screen.findByText('verified')).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('restored with a session, asks', () => {
    const verify = vi.fn();
    const { rerender } = render(at('/login#token_hash=restoring-in', verify, undefined));
    rerender(at('/login#token_hash=restoring-in', verify, loggedIn));
    expect(screen.getByText('ask')).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it('does not ask again when the screen mounts with the session the link just started', async () => {
    let finish!: () => void;
    const verify = vi.fn(
      () => new Promise<{ error: null }>((resolve) => (finish = () => resolve({ error: null }))),
    );
    const first = render(at('/login#token_hash=link-logged-in', verify, null));
    first.unmount();
    render(at('/login#token_hash=link-logged-in', verify, loggedIn));
    expect(screen.getByText('verifying')).toBeInTheDocument();
    finish();

    expect(await screen.findByText('verified')).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
  });
});
