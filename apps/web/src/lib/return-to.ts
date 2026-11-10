import { useSearchParams } from 'react-router';

// Where to go back after logging in: a private page opened without a session (e.g. an invite link,
// `/grupos/unirme?codigo=…`) sends to `/login?volver=<that page>`, and login, register and Google
// come back to it instead of always to /grupos.

const PARAM = 'volver';
const GOOGLE_KEY = 'kachingga-volver';
export const HOME = '/grupos';

/** Only paths inside the app: never another site (`//evil.com`, `https://…`), so a link can't redirect out. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return HOME;
  return value;
}

/** `/login` (or `/registro`) keeping where to go back, if it isn't just the home. */
export function withReturnTo(path: '/login' | '/registro', returnTo: string) {
  return returnTo === HOME || returnTo === '/'
    ? path
    : `${path}?${PARAM}=${encodeURIComponent(returnTo)}`;
}

/** Where login / register send to after a successful login. */
export function useReturnTo() {
  const [searchParams] = useSearchParams();
  return safeReturnTo(searchParams.get(PARAM));
}

// Google leaves the app and comes back to `/`: the destination waits in sessionStorage (same tab).
export function rememberReturnToForGoogle(returnTo: string) {
  try {
    if (returnTo !== HOME) sessionStorage.setItem(GOOGLE_KEY, returnTo);
  } catch {
    // Storage blocked: back to the home, as before.
  }
}

/** The destination saved before going to Google (read only: call `forgetReturnToFromGoogle` after). */
export function readReturnToFromGoogle(): string {
  try {
    return safeReturnTo(sessionStorage.getItem(GOOGLE_KEY));
  } catch {
    return HOME;
  }
}

export function forgetReturnToFromGoogle() {
  try {
    sessionStorage.removeItem(GOOGLE_KEY);
  } catch {
    // Nothing saved if storage isn't available.
  }
}
