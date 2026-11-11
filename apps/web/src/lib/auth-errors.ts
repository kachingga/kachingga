import type { AuthError } from '@supabase/supabase-js';

// Supabase Auth answers in English. What someone can hit on login, register and password recovery,
// in Spanish (by `error.code`); anything else, a generic message (never the raw one).
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'El email o la contraseña no son correctos.',
  email_not_confirmed: 'Todavía no confirmaste tu email.',
  user_already_exists: 'Ya hay una cuenta con ese email. Entrá o recuperá tu contraseña.',
  email_exists: 'Ya hay una cuenta con ese email. Entrá o recuperá tu contraseña.',
  email_address_invalid: 'Ese email no es válido.',
  weak_password: 'La contraseña es muy débil: usá al menos 8 caracteres.',
  same_password: 'La contraseña nueva tiene que ser distinta de la anterior.',
  captcha_failed: 'No pudimos comprobar que no sos un robot. Probá de nuevo.',
  over_email_send_rate_limit:
    'Mandamos muchos mails seguidos. Esperá unos minutos y probá de nuevo.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.',
  // "Allow new users to sign up" off in Supabase (INFRA.md → "Supabase").
  signup_disabled: 'Por ahora no se pueden crear cuentas nuevas.',
};

export const GOOGLE_FAILED = 'No se pudo entrar con Google. Probá de nuevo o usá tu email.';

/** Google came back to the app with an error (Supabase's `error_code`, or `error`). */
export function googleErrorMessage(code: string): string {
  return code === 'signup_disabled' ? MESSAGES.signup_disabled : GOOGLE_FAILED;
}

export function authErrorMessage(error: AuthError): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  // Network down or Supabase unreachable.
  if (error.name === 'AuthRetryableFetchError')
    return 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
  return 'Algo salió mal. Probá de nuevo en un rato.';
}
