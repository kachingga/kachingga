import type { AuthError } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

type EmailLinkStatus = 'none' | 'verifying' | 'verified' | 'invalid';

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
  // Once: the token is single-use (and StrictMode runs effects twice in dev).
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verify(token).then(
      ({ error }) => {
        setStatus(error ? 'invalid' : 'verified');
        if (!error)
          void navigate(
            { pathname: location.pathname, search: location.search },
            { replace: true },
          );
      },
      () => setStatus('invalid'),
    );
  }, [token, verify, navigate, location.pathname, location.search]);

  return status;
}
