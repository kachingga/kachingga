import type { AuthError, Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router';
import { toast } from 'sonner';

import { HOME } from '@/lib/return-to';

type EmailLinkStatus = 'none' | 'ask' | 'verifying' | 'verified' | 'invalid';
// `data.session`: the session the link started, if it started one (auth-js `verifyOtp`).
type Verification = {
  error: AuthError | null;
  data?: { session?: { user?: { email?: string } } | null };
};

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
 *
 * `session`: the one already open in this browser (`useSession()`). With one, the link isn't used on
 * its own: 'ask' until the person picks, `proceed` to use it or `stay` to keep the open session (it
 * drops the token and goes to the home). While the session is still being restored (`undefined`) it
 * waits. If the link starts a session, a toast says whose.
 */
export function useEmailLinkResult<R extends Verification>(
  verify: (tokenHash: string) => Promise<R>,
  session: Session | null | undefined,
): { status: EmailLinkStatus; result: R | null; proceed: () => void; stay: () => void } {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, inUrl } = linkToken(location);
  const [answer, setAnswer] = useState<{ token: string; result: R | null }>();
  // The token the person chose to use with a session open.
  const [chosen, setChosen] = useState<string>();

  // Already being exchanged (e.g. the screen mounted again after the link logged in), chosen, or
  // nobody logged in: it can be used.
  const usable =
    token !== null && (verifications.has(token) || chosen === token || session === null);

  useEffect(() => {
    if (!token || !usable) return;
    let verification = verifications.get(token);
    if (!verification) {
      verification = verify(token).then(
        (result) => {
          // Once per token (not per mount): which account the link logged in to.
          const email = result.error ? undefined : result.data?.session?.user?.email;
          if (email) toast.success(`Entraste como ${email}`);
          return result;
        },
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
  }, [token, usable, inUrl, verify, navigate, location.pathname, location.search]);

  const proceed = () => setChosen(token ?? undefined);
  // Replacing the entry takes the token out of the URL and the history.
  const stay = () => void navigate(HOME, { replace: true });

  if (!token) return { status: 'none', result: null, proceed, stay };
  if (!usable && session) return { status: 'ask', result: null, proceed, stay };
  if (answer?.token !== token) return { status: 'verifying', result: null, proceed, stay };
  const { result } = answer;
  return { status: result && !result.error ? 'verified' : 'invalid', result, proceed, stay };
}

/** `useEmailLinkResult`, when only whether the link worked matters. */
export function useEmailLink(
  verify: (tokenHash: string) => Promise<Verification>,
  session: Session | null | undefined,
): { status: EmailLinkStatus; proceed: () => void; stay: () => void } {
  const { status, proceed, stay } = useEmailLinkResult(verify, session);
  return { status, proceed, stay };
}
