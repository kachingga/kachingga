import { useLocation, useNavigate } from 'react-router';

/** Router state marking a navigation as "going back" (for the screen transition). */
export interface BackState {
  back: true;
}

/**
 * Closes the current screen and goes back to where it was opened from (e.g. the group after
 * saving an expense). Inside the app that's a real "back" (`navigate(-1)`): it animates as going
 * back and doesn't leave the screen twice in the history. If the screen was opened directly from
 * a link (nothing to go back to), it goes to `fallback`, still animating as going back.
 */
export function useGoBack() {
  const location = useLocation();
  const navigate = useNavigate();
  return (fallback: string) => {
    if (location.key !== 'default') void navigate(-1);
    else void navigate(fallback, { replace: true, state: { back: true } satisfies BackState });
  };
}
