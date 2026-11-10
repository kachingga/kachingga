import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';

import { forgetReturnToFromGoogle, readReturnToFromGoogle } from '@/lib/return-to';

/**
 * `/`: where Google comes back to after logging in. Goes on to the page it was opening before
 * (e.g. an invite link, saved in sessionStorage by `GoogleSignIn`), or to /grupos.
 */
export function AfterGoogle() {
  const [to] = useState(readReturnToFromGoogle);
  useEffect(() => forgetReturnToFromGoogle(), []);
  return <Navigate to={to} replace />;
}
