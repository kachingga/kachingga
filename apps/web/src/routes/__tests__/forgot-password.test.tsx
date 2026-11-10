import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApi } from '@/test/render';
import { ForgotPassword } from '@/routes/forgot-password';

vi.mock('@/lib/auth', () => ({
  requestPasswordReset: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));
vi.mock('@marsidev/react-turnstile', () => import('@/test/fake-turnstile'));

afterEach(() => vi.unstubAllEnvs());

async function askForLink(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.click(screen.getByRole('button', { name: 'Mandame el link' }));
}

describe('ForgotPassword', () => {
  it('asks for the email, with a way back to the login', () => {
    renderWithApi(<ForgotPassword />);
    expect(screen.getByRole('heading', { name: '¿Olvidaste tu contraseña?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrá' })).toHaveAttribute('href', '/login');
  });

  it("sends the mail and doesn't reveal whether the account exists", async () => {
    const { requestPasswordReset } = await import('@/lib/auth');
    const user = userEvent.setup();
    renderWithApi(<ForgotPassword />);

    await askForLink(user);

    expect(requestPasswordReset).toHaveBeenLastCalledWith('test@example.com', undefined);
    expect(await screen.findByRole('heading', { name: 'Revisá tu mail' })).toBeInTheDocument();
    expect(
      screen.getByText((_, el) =>
        Boolean(
          el?.tagName === 'P' &&
            el.textContent?.startsWith('Si hay una cuenta con test@example.com, te llegó un mail'),
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a entrar' })).toHaveAttribute('href', '/login');

    await user.click(screen.getByRole('button', { name: 'Pedir otro mail' }));
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com');
  });

  it('shows the error in Spanish when it could not send it', async () => {
    const { requestPasswordReset } = await import('@/lib/auth');
    vi.mocked(requestPasswordReset).mockResolvedValueOnce({
      data: null,
      error: {
        message: 'email rate limit exceeded',
        code: 'over_email_send_rate_limit',
        name: 'AuthApiError',
        status: 429,
      } as never,
    });
    const user = userEvent.setup();
    renderWithApi(<ForgotPassword />);

    await askForLink(user);

    expect(
      await screen.findByText(
        'Mandamos muchos mails seguidos. Esperá unos minutos y probá de nuevo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Revisá tu mail' })).not.toBeInTheDocument();
  });

  it('with captcha: waits for it and sends its token', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-site-key');
    const { requestPasswordReset } = await import('@/lib/auth');
    const user = userEvent.setup();
    renderWithApi(<ForgotPassword />);

    expect(screen.getByRole('button', { name: 'Mandame el link' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Resolver captcha' }));
    await askForLink(user);

    expect(requestPasswordReset).toHaveBeenLastCalledWith('test@example.com', 'captcha-token');
  });
});
