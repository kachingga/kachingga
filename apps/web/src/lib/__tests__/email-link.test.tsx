import { render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { useEmailLink, useEmailLinkResult } from '@/lib/email-link';

function Screen({ verify }: { verify: Parameters<typeof useEmailLink>[0] }) {
  return <p>{useEmailLink(verify)}</p>;
}

const at = (route: string, verify: Parameters<typeof useEmailLink>[0]) => (
  <MemoryRouter initialEntries={[route]}>
    <Screen verify={verify} />
  </MemoryRouter>
);

describe('useEmailLink', () => {
  it('is "none" without a token in the URL', () => {
    const verify = vi.fn();
    render(at('/login', verify));
    expect(screen.getByText('none')).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it('exchanges the token once even if the screen mounts again before it finishes', async () => {
    let finish!: () => void;
    const verify = vi.fn(
      () => new Promise<{ error: null }>((resolve) => (finish = () => resolve({ error: null }))),
    );
    // Logging in remounts the whole app (ApiProvider): the second mount still has the token.
    const first = render(at('/login#token_hash=remount', verify));
    expect(screen.getByText('verifying')).toBeInTheDocument();
    first.unmount();
    render(at('/login#token_hash=remount', verify));
    finish();

    expect(await screen.findByText('verified')).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('takes the token out of the URL and a screen mounted again still gets the answer', async () => {
    const verify = vi.fn(async () => ({ error: null, data: { email: 'nuevo@example.com' } }));
    function Result() {
      const { status, result } = useEmailLinkResult(verify);
      const location = useLocation();
      return (
        <p>
          {status} {result?.data.email} {location.hash || 'sin-hash'}
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
  });

  it('after a reload, the token kept in the history is not tried again', () => {
    const verify = vi.fn();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/cambiar-email', state: { emailLink: 'used' } }]}>
        <Screen verify={verify} />
      </MemoryRouter>,
    );
    expect(screen.getByText('none')).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it('an expired link is "invalid" and stays in the URL', async () => {
    const verify = vi.fn().mockResolvedValue({ error: { code: 'otp_expired' } });
    function Result() {
      const status = useEmailLink(verify);
      return (
        <p>
          {status} {useLocation().hash}
        </p>
      );
    }
    render(
      <MemoryRouter initialEntries={['/login#token_hash=expired']}>
        <Result />
      </MemoryRouter>,
    );
    expect(await screen.findByText('invalid #token_hash=expired')).toBeInTheDocument();
  });
});
