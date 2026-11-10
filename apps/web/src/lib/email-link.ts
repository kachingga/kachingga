import type { AuthError } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router';

type EmailLinkStatus = 'none' | 'verifying' | 'verified' | 'invalid';
type Verification = { error: AuthError | null };

// Shared by every mount of a screen. Logging in remounts the whole app (ApiProvider keys its cache by
// user), so the screen can mount again, with the token still in the URL or already out of it: it must
// reuse this answer instead of exchanging a single-use token twice (the second time it would say the
// link expired). `null`: the exchange threw.
const verifications = new Map<string, Promise<Verification | null>>();

/**
 * The link's token: in the hash when the link opens; once exchanged, in the history entry's state
 * (out of the URL), so a screen mounted again still finds its answer. Only while the page lives (the
 * answers are in memory): after a reload it isn't tried again.
 */
function linkToken(location: Location): { token: string | null; inUrl: boolean } {
  const inHash = new URLSearchParams(location.hash.slice(1)).get('token_hash');
  if (inHash) return { token: inHash, inUrl: true };
  const kept: unknown = (location.state as { emailLink?: unknown } | null)?.emailLink;
  return { token: typeof kept === 'string' && verifications.has(kept) ? kept : null, inUrl: false };
}

/**
 * The links in our mails (confirm the email, recover the password, change the email) come back to the
 * app with a single-use token in the hash (`#token_hash=…`, see the templates in INFRA.md →
 * "Supabase"): in the hash it never reaches a server nor a Referer. When the screen opens, `verify`
 * exchanges it (it works in any browser, unlike a PKCE code) and the token leaves the URL, so
 * reloading doesn't try it again. 'none' when the URL has no token. `result`: what `verify` answered
 * (null until then, or if it threw).
 */
export function useEmailLinkResult<R extends Verification>(
  verify: (tokenHash: string) => Promise<R>,
): { status: EmailLinkStatus; result: R | null } {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, inUrl } = linkToken(location);
  const [answer, setAnswer] = useState<{ token: string; result: R | null }>();

  useEffect(() => {
    if (!token) return;
    let verification = verifications.get(token);
    if (!verification) {
      verification = verify(token).then(
        (result) => result,
        () => null,
      );
      verifications.set(token, verification);
    }
    let active = true;
    void verification.then((result) => {
      if (!active) return;
      // Same token, same screen: what it answered is this `verify`'s result.
      setAnswer({ token, result: result as R | null });
      if (result && !result.error && inUrl)
        void navigate(
          { pathname: location.pathname, search: location.search },
          { replace: true, state: { emailLink: token } },
        );
    });
    return () => {
      active = false;
    };
  }, [token, inUrl, verify, navigate, location.pathname, location.search]);

  if (!token) return { status: 'none', result: null };
  if (answer?.token !== token) return { status: 'verifying', result: null };
  const { result } = answer;
  return { status: result && !result.error ? 'verified' : 'invalid', result };
}

/** `useEmailLinkResult`, when only whether the link worked matters. */
export function useEmailLink(
  verify: (tokenHash: string) => Promise<Verification>,
): EmailLinkStatus {
  return useEmailLinkResult(verify).status;
}
