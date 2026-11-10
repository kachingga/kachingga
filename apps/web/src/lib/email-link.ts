import type { AuthError } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

type EmailLinkStatus = 'none' | 'verifying' | 'verified' | 'invalid';

// Shared by every mount of a screen. Logging in remounts the whole app (ApiProvider keys its cache by
// user), so the screen can mount again with the token still in the URL: it must reuse this result
// instead of exchanging a single-use token twice (the second time it would say the link expired).
const verifications = new Map<string, Promise<boolean>>();

/**
 * The links in our mails (confirm the email, recover the password) come back to the app with a
 * single-use token in the hash (`#token_hash=…`, see the templates in INFRA.md → "Supabase"): in the
 * hash it never reaches a server nor a Referer. When the screen opens, `verify` exchanges it for a
 * session (it works in any browser, unlike a PKCE code) and the token leaves the URL, so reloading
 * doesn't try it again. 'none' when the URL has no token.
 */
export function useEmailLink(
  verify: (tokenHash: string) => Promise<{ error: AuthError | null }>,
): EmailLinkStatus {
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.hash.slice(1)).get('token_hash');
  const [status, setStatus] = useState<EmailLinkStatus>(token ? 'verifying' : 'none');

  useEffect(() => {
    if (!token) return;
    let verification = verifications.get(token);
    if (!verification) {
      verification = verify(token).then(
        ({ error }) => !error,
        () => false,
      );
      verifications.set(token, verification);
    }
    let active = true;
    void verification.then((ok) => {
      if (!active) return;
      setStatus(ok ? 'verified' : 'invalid');
      if (ok)
        void navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    });
    return () => {
      active = false;
    };
  }, [token, verify, navigate, location.pathname, location.search]);

  return status;
}
