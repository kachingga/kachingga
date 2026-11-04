import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { ApiProvider } from '@/components/api-provider';
import { ConfirmProvider } from '@/components/confirm-provider';
import { Toaster } from '@/components/ui/sonner';
import { router } from '@/router';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </ConfirmProvider>
    </ApiProvider>
  </StrictMode>,
);
