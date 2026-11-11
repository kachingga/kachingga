import { describe, expect, it } from 'vitest';

import { authErrorMessage, googleErrorMessage } from '@/lib/auth-errors';

const error = (fields: { code?: string; status?: number; name?: string; message?: string }) =>
  ({ name: 'AuthApiError', message: 'raw', ...fields }) as never;

describe('authErrorMessage', () => {
  it('translates what can happen on login, register and recovery', () => {
    expect(authErrorMessage(error({ code: 'invalid_credentials', status: 400 }))).toBe(
      'El email o la contraseña no son correctos.',
    );
    expect(authErrorMessage(error({ code: 'user_already_exists', status: 422 }))).toBe(
      'Ya hay una cuenta con ese email. Entrá o recuperá tu contraseña.',
    );
    expect(authErrorMessage(error({ code: 'weak_password', status: 422 }))).toBe(
      'La contraseña es muy débil: usá al menos 8 caracteres.',
    );
    expect(authErrorMessage(error({ code: 'captcha_failed', status: 400 }))).toBe(
      'No pudimos comprobar que no sos un robot. Probá de nuevo.',
    );
    expect(authErrorMessage(error({ code: 'over_request_rate_limit', status: 429 }))).toBe(
      'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.',
    );
  });

  it('sign-ups closed in Supabase', () => {
    expect(authErrorMessage(error({ code: 'signup_disabled', status: 422 }))).toBe(
      'Por ahora no se pueden crear cuentas nuevas.',
    );
  });

  it('a 429 without a known code is a rate limit', () => {
    expect(authErrorMessage(error({ status: 429 }))).toBe(
      'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.',
    );
  });

  it('without connection', () => {
    expect(authErrorMessage(error({ name: 'AuthRetryableFetchError', status: 0 }))).toBe(
      'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.',
    );
  });

  it('anything else: a generic message, never the raw one', () => {
    expect(authErrorMessage(error({ code: 'unexpected_failure', status: 500 }))).toBe(
      'Algo salió mal. Probá de nuevo en un rato.',
    );
  });
});

describe('googleErrorMessage', () => {
  it('sign-ups closed', () => {
    expect(googleErrorMessage('signup_disabled')).toBe(
      'Por ahora no se pueden crear cuentas nuevas.',
    );
  });

  it('anything else: Google failed', () => {
    expect(googleErrorMessage('access_denied')).toBe(
      'No se pudo entrar con Google. Probá de nuevo o usá tu email.',
    );
  });
});
