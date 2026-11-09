import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { ApiProvider } from '@/components/api-provider';
import { ConfirmProvider } from '@/components/confirm-provider';
import { OfflineBanner } from '@/components/offline-banner';
import { Toaster } from '@/components/ui/sonner';
import { initMonitoring } from '@/lib/monitoring';
import { syncOnlineAtStartup } from '@/lib/offline-cache';
import { router } from '@/router';

initMonitoring();
syncOnlineAtStartup();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <OfflineBanner />
        <Toaster position="top-center" />
      </ConfirmProvider>
    </ApiProvider>
  </StrictMode>,
);
