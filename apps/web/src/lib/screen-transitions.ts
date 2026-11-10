import type {
  createBrowserRouter,
  Location,
  NavigationType,
  RouterNavigateOptions,
  To,
} from 'react-router';

import type { BackState } from '@/lib/use-go-back';

// How screens change (src/components/animated-layout.tsx + index.css). Details and how to test it:
// docs/claude/web/sensacion-de-app.md → "Transiciones entre pantallas".

/**
 * The switch. `true`: View Transitions API, the browser animates the old and the new screen at
 * the same time, like iOS (where it exists; elsewhere, the CSS slide). `false`: back to the CSS
 * slide everywhere (only the new screen moves).
 */
export const VIEW_TRANSITIONS = true;

export const viewTransitionsSupported = () =>
  typeof document !== 'undefined' && typeof document.startViewTransition === 'function';

/**
 * Which way the screen change goes: `forward` (comes from the right), `back` (from the left) or
 * `none` (no animation: the first screen when opening the app, or the browser already animated it).
 */
export type Direction = 'forward' | 'back' | 'none';

// Safari's swipe from the edge to go back (and Android's back gesture) animate the page before
// the app hears about it: then the app doesn't animate again (it would look doubled). The browser
// says so in the `popstate` event (`hasUAVisualTransition`). Listened in the capture phase, before
// the router's own listener.
let browserAnimated = false;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'popstate',
    (event: PopStateEvent & { hasUAVisualTransition?: boolean }) => {
      browserAnimated = event.hasUAVisualTransition === true;
    },
    { capture: true },
  );
}

/**
 * The direction of a navigation from the screen at `from` (a path) to `location`, arrived at by
 * `navType`. Going up to a screen that contains the current one (e.g. "Mis grupos" from a group,
 * or the group from one of its expenses) is going back too, even with a link.
 */
export function screenDirection(
  from: string,
  location: Location,
  navType: NavigationType,
): Direction {
  // POP = the browser's back (button or gesture), `navigate(-1)` or `useGoBack()`.
  if (navType === 'POP') return browserAnimated ? 'none' : 'back';
  if ((location.state as BackState | null)?.back === true) return 'back';
  const up = from.startsWith(location.pathname.replace(/\/?$/, '/'));
  return up ? 'back' : 'forward';
}

/**
 * Every navigation to another screen (another path) goes with `viewTransition`: React Router
 * then changes the screen inside `document.startViewTransition`, and going back (POP) to a screen
 * it arrived at that way animates too. Patched here once instead of on every `<Link>` and
 * `navigate()`. Changing only the search params (the filters in the URL) doesn't animate.
 */
export function withViewTransitions<R extends ReturnType<typeof createBrowserRouter>>(router: R) {
  if (!VIEW_TRANSITIONS || !viewTransitionsSupported()) return router;
  const navigate = router.navigate.bind(router);
  router.navigate = ((to: number | To | null, opts?: RouterNavigateOptions) => {
    if (typeof to === 'number') return navigate(to);
    if (to === null) return navigate(to, opts);
    const path =
      typeof to === 'string'
        ? new URL(to, window.location.href).pathname
        : (to.pathname ?? window.location.pathname);
    // `<Link>` passes `viewTransition: undefined`: only an explicit value wins.
    const viewTransition = opts?.viewTransition ?? path !== window.location.pathname;
    return navigate(to, { ...opts, viewTransition });
  }) as R['navigate'];
  return router;
}
