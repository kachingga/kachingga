import { useLayoutEffect, useState } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router';
import { cn } from 'cn';

import {
  screenDirection,
  VIEW_TRANSITIONS,
  viewTransitionsSupported,
  type Direction,
} from '@/lib/screen-transitions';

/**
 * Animates the change from one screen to the next (how: src/lib/screen-transitions.ts and
 * docs/claude/web/sensacion-de-app.md). A new screen is a new path: changing only the search
 * params (the filters in the URL) stays on the same screen, without remounting nor animating it.
 */
export function AnimatedLayout({ className }: { className?: string }) {
  const location = useLocation();
  const navType = useNavigationType();

  // The direction is decided when the path changes (the first screen doesn't animate).
  const [screen, setScreen] = useState<{ path: string; direction: Direction }>({
    path: location.pathname,
    direction: 'none',
  });
  if (location.pathname !== screen.path) {
    setScreen({
      path: location.pathname,
      direction: screenDirection(screen.path, location, navType),
    });
  }
  const { path, direction } = screen;

  // The View Transition's CSS (index.css) reads the direction from <html>. Layout effects run in
  // the commit, before the browser starts animating.
  useLayoutEffect(() => {
    document.documentElement.dataset.nav = direction;
  }, [path, direction]);

  const viewTransitions = VIEW_TRANSITIONS && viewTransitionsSupported();
  return (
    <div
      key={path}
      className={cn(
        className,
        // View Transitions: the old and the new screen are "page", the browser animates both.
        viewTransitions && '[view-transition-name:page]',
        // Fallback (no View Transitions, or turned off): only the new screen slides in.
        !viewTransitions && direction === 'forward' && 'page-enter-right',
        !viewTransitions && direction === 'back' && 'page-enter-left',
      )}
    >
      <Outlet />
    </div>
  );
}
