import { useEffect } from 'react';

const APP = 'Kachingga';

/**
 * The tab's title for this screen ("Mis grupos · Kachingga"): what the browser, its history and
 * screen readers show. Back to "Kachingga" when the screen closes.
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP;
    return () => {
      document.title = APP;
    };
  }, [title]);
}
