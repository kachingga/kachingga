import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { ApiProvider } from '@/components/api-provider';
import { router } from '@/router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider>
      <RouterProvider router={router} />
    </ApiProvider>
  </StrictMode>,
);
