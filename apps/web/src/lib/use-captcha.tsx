import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useRef, useState } from 'react';

import { useTheme } from '@/lib/theme';

/**
 * Cloudflare Turnstile in front of what tries passwords or sends mails (email login, register,
 * "¿Olvidaste tu contraseña?" and "Reenviar mail"): Supabase Auth checks the token (Authentication →
 * Attack Protection). Without `VITE_TURNSTILE_SITE_KEY` (local, tests) there's no widget and no token.
 * Put `widget` above the submit button, send `token`, don't send while `waiting`, and `reset()`
 * after each attempt that used the token: tokens are single-use.
 *
 * The flexible widget is at least 300 px wide: on a phone narrower than 360 px (an iPhone SE with
 * "Zoom de pantalla") it pushed the form out of the screen, so there it's the compact one (#169).
 */
export function useCaptcha() {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const theme = useTheme();
  const ref = useRef<TurnstileInstance>(null);
  const [token, setToken] = useState<string | null>(null);
  const size = window.matchMedia('(max-width: 359px)').matches ? 'compact' : 'flexible';

  return {
    widget: siteKey ? (
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={setToken}
        onExpire={() => setToken(null)}
        onError={() => setToken(null)}
        options={{ theme, language: 'es', size }}
      />
    ) : null,
    token: token ?? undefined,
    /** On, but without a token yet (still checking, or it failed): Supabase would reject it. */
    waiting: Boolean(siteKey) && !token,
    reset() {
      setToken(null);
      ref.current?.reset();
    },
  };
}
