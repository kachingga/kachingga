import { Outlet, useLocation, useNavigationType } from 'react-router';

export function AnimatedLayout() {
  const location = useLocation();
  const navType = useNavigationType();
  const className = navType === 'POP' ? 'page-enter-left' : 'page-enter-right';
  return (
    <div key={location.key} className={className}>
      <Outlet />
    </div>
  );
}
