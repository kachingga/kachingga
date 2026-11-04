import { Outlet, useLocation, useNavigationType } from 'react-router';

import type { BackState } from '@/lib/use-go-back';

// Each navigation remounts the page (new `key`), which replays its CSS animation (index.css):
// going forward slides in from the right, going back (browser back, `navigate(-1)` or `useGoBack`)
// from the left.
export function AnimatedLayout() {
  const location = useLocation();
  const navType = useNavigationType();
  const back = navType === 'POP' || (location.state as BackState | null)?.back === true;
  return (
    <div key={location.key} className={back ? 'page-enter-left' : 'page-enter-right'}>
      <Outlet />
    </div>
  );
}
