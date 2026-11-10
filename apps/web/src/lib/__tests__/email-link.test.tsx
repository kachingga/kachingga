import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { useEmailLink } from '@/lib/email-link';

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
});
