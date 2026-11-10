import { NavigationType, type Location } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { screenDirection, withViewTransitions } from '@/lib/screen-transitions';

const at = (pathname: string, state: unknown = null) => ({ pathname, state }) as Location;

/** A `popstate` like the browser's: `hasUAVisualTransition` = it already animated it (Safari's swipe). */
function popstate(hasUAVisualTransition: boolean) {
  const event = new PopStateEvent('popstate');
  Object.defineProperty(event, 'hasUAVisualTransition', { value: hasUAVisualTransition });
  window.dispatchEvent(event);
}

describe('screenDirection', () => {
  it('forward when opening a screen, back with the back button or `useGoBack`', () => {
    expect(screenDirection(at('/grupos/g1'), NavigationType.Push)).toBe('forward');
    expect(screenDirection(at('/grupos/g1/pagos'), NavigationType.Replace)).toBe('forward');
    popstate(false);
    expect(screenDirection(at('/grupos'), NavigationType.Pop)).toBe('back');
    expect(screenDirection(at('/grupos/g1', { back: true }), NavigationType.Replace)).toBe('back');
  });

  it('no animation when the browser already animated the back (Safari swipe from the edge)', () => {
    popstate(true);
    expect(screenDirection(at('/grupos'), NavigationType.Pop)).toBe('none');
    // The next back with the button animates again.
    popstate(false);
    expect(screenDirection(at('/grupos'), NavigationType.Pop)).toBe('back');
  });
});

describe('withViewTransitions', () => {
  afterEach(() => {
    delete (document as { startViewTransition?: unknown }).startViewTransition;
  });

  function fakeRouter() {
    const navigate = vi.fn();
    const router = withViewTransitions({ navigate } as never) as { navigate: typeof navigate };
    return { router, navigate };
  }

  it('without View Transitions in the browser, leaves the router as it is', () => {
    const { router, navigate } = fakeRouter();
    expect(router.navigate).toBe(navigate);
  });

  it('every navigation to another screen goes with a View Transition', () => {
    document.startViewTransition = vi.fn() as never;
    const { router, navigate } = fakeRouter();
    // jsdom is at "/".
    router.navigate('/grupos/g1');
    expect(navigate).toHaveBeenLastCalledWith('/grupos/g1', { viewTransition: true });
    // <Link> passes `viewTransition: undefined` and its own options.
    router.navigate({ pathname: '/grupos' }, { replace: true, viewTransition: undefined });
    expect(navigate).toHaveBeenLastCalledWith(
      { pathname: '/grupos' },
      { replace: true, viewTransition: true },
    );
    // Going back is the router's (it animates POP to a screen it arrived at with one).
    router.navigate(-1);
    expect(navigate).toHaveBeenLastCalledWith(-1);
  });

  it('changing only the search params (the filters) does not animate', () => {
    document.startViewTransition = vi.fn() as never;
    const { router, navigate } = fakeRouter();
    router.navigate('?q=cena', { replace: true });
    expect(navigate).toHaveBeenLastCalledWith('?q=cena', { replace: true, viewTransition: false });
    router.navigate('/');
    expect(navigate).toHaveBeenLastCalledWith('/', { viewTransition: false });
  });
});
