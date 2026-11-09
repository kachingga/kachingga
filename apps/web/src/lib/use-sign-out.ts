import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { signOut } from '@/lib/auth';
import { clearOfflineCache } from '@/lib/offline-cache';

/** Signs out and leaves nothing of the account on the device (offline cache, memory). */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await signOut();
    clearOfflineCache();
    queryClient.clear();
    void navigate('/login');
  };
}
