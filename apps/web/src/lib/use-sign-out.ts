import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { signOut } from '@/lib/auth';
import { clearOfflineCache } from '@/lib/offline-cache';
import { unsubscribeHere } from '@/lib/push';
import { useTRPC } from '@/lib/trpc';

// How long signing out waits for the API to turn the notifications off everywhere.
const UNSUBSCRIBE_ALL_WAIT_MS = 2000;

/**
 * Signs out and leaves nothing of the account on the device (offline cache, memory, notifications).
 * Signing out is everywhere (Supabase revokes every session), so the notifications go off on every
 * device too: a device someone else turned on with this account stops getting them. With no
 * connection (or if the API takes long) it signs out anyway.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { mutateAsync: offEverywhere } = useMutation(
    trpc.notifications.unsubscribeAll.mutationOptions(),
  );
  return async () => {
    if (onlineManager.isOnline()) {
      await Promise.race([
        offEverywhere().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, UNSUBSCRIBE_ALL_WAIT_MS)),
      ]);
    }
    void unsubscribeHere();
    await signOut();
    clearOfflineCache();
    queryClient.clear();
    void navigate('/login');
  };
}
