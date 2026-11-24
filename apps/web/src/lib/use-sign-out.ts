import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { signOut } from '@/lib/auth';
import { clearOfflineCache } from '@/lib/offline-cache';
import { unsubscribeHere } from '@/lib/push';

/**
 * Signs out and leaves nothing of the account on the device (offline cache, memory, notifications:
 * this browser stops getting them).
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    void unsubscribeHere();
    await signOut();
    clearOfflineCache();
    queryClient.clear();
    void navigate('/login');
  };
}
