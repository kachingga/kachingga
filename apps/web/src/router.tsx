import { createBrowserRouter } from 'react-router';

import { Home } from '@/routes/home';

// Routes live here; screens in src/routes/. Protect private routes by nesting them under
// { element: <RequireAuth /> } (src/components/require-auth.tsx).
export const router = createBrowserRouter([{ path: '/', element: <Home /> }]);
