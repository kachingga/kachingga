import { useState, type CSSProperties } from 'react';

import { LogoMark } from '@/components/app-shell';

/**
 * The logo alone on the background, while something has to load before the first screen (the
 * session). Same classes as the splash in index.html (size and animation are there), which it
 * replaces when React mounts: the animation is set to the time since the page opened
 * (`--splash-delay`), so the logo keeps breathing instead of starting over.
 */
export function Splash() {
  const [elapsed] = useState(() => performance.now());
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="splash"
      style={{ '--splash-delay': `${-elapsed}ms` } as CSSProperties}
    >
      <LogoMark />
    </div>
  );
}
