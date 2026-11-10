import { useImperativeHandle, useState, type Ref } from 'react';

/**
 * Stand-in for Cloudflare's widget in screen tests:
 * `vi.mock('@marsidev/react-turnstile', () => import('@/test/fake-turnstile'))` + `vi.stubEnv`
 * of `VITE_TURNSTILE_SITE_KEY`. "Resolver captcha" hands over the token `captcha-token`; `reset()`
 * (a new token after each attempt) shows the button again.
 */
export function Turnstile({
  ref,
  onSuccess,
}: {
  ref?: Ref<{ reset: () => void }>;
  onSuccess?: (token: string) => void;
}) {
  const [solved, setSolved] = useState(false);
  useImperativeHandle(ref, () => ({ reset: () => setSolved(false) }));
  if (solved) return <p>Captcha resuelto</p>;
  return (
    <button
      type="button"
      onClick={() => {
        setSolved(true);
        onSuccess?.('captcha-token');
      }}
    >
      Resolver captcha
    </button>
  );
}
