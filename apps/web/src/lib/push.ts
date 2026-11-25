import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useTRPC } from '@/lib/trpc';

// Notifications on this device (Web Push): docs/claude/web/notificaciones.md. The handlers that show
// them live in the service worker (public/push-sw.js); this is the page's side.

/** Which account turned them on in this browser (so another account never gets that one's). */
const OWNER_KEY = 'kachingga-push-user';

/**
 * Whether this browser can get notifications and, if not, why: an iPhone or iPad only gets them with
 * the app on the home screen (opened from there); "denied" = the person blocked them for the site.
 */
export type PushSupport = 'available' | 'denied' | 'needs-install' | 'unsupported';

function isAppleMobile() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS says it's a Mac
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function pushSupport(): PushSupport {
  const capable =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!capable) return isAppleMobile() ? 'needs-install' : 'unsupported';
  return Notification.permission === 'denied' ? 'denied' : 'available';
}

/** The VAPID public key (base64url) as the bytes `pushManager.subscribe` wants. */
export function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** This browser's subscription, if it has one (without a service worker, none). */
async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager?.getSubscription()) ?? null;
}

/** The endpoint of this browser's subscription (what the API knows it by), or null. */
export async function currentEndpoint(): Promise<string | null> {
  return (await currentSubscription().catch(() => null))?.endpoint ?? null;
}

export type DeviceSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

/**
 * How long subscribing can take. Some browsers never answer (a Chromium without Google's push
 * service, or no service worker, like with `bun run dev`): then it fails instead of loading forever.
 */
export const SUBSCRIBE_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('El navegador no respondió')),
      SUBSCRIBE_TIMEOUT_MS,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Asks for permission (has to come from a tap) and subscribes this browser. Null if the person
 * didn't allow them. A subscription made with another key (the API's keys changed) is replaced.
 */
export async function subscribeHere(
  publicKey: string,
  userId: string,
): Promise<DeviceSubscription | null> {
  if ((await Notification.requestPermission()) !== 'granted') return null;
  const subscription = await withTimeout(
    (async () => {
      const registration = await navigator.serviceWorker.ready;
      const options = { userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) };
      try {
        return await registration.pushManager.subscribe(options);
      } catch {
        await (await registration.pushManager.getSubscription())?.unsubscribe();
        return await registration.pushManager.subscribe(options);
      }
    })(),
  );
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Storage blocked: it's unsubscribed on sign-out anyway
  }
  return subscription.toJSON() as DeviceSubscription;
}

/**
 * Stops this browser's notifications (the push service drops it; the API forgets it on the next
 * send), and takes away what's still on screen: the ones in the notification center and the number
 * on the app icon (the next person on this device mustn't see them).
 */
export async function unsubscribeHere() {
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {
    // Nothing saved
  }
  await (await currentSubscription().catch(() => null))?.unsubscribe().catch(() => false);
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  const shown = (await registration?.getNotifications?.().catch(() => [])) ?? [];
  for (const notification of shown) notification.close();
  if ('clearAppBadge' in navigator) await navigator.clearAppBadge().catch(() => {});
}

/**
 * Nobody else gets one account's notifications on this device: when the session ends (by any
 * path) this browser unsubscribes, and the same with a session of another account. Called once at
 * startup (`main.tsx`), like `syncOfflineCacheWithSession`.
 */
export function syncPushWithSession() {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    let owner: string | null = null;
    try {
      owner = localStorage.getItem(OWNER_KEY);
    } catch {
      // Storage blocked
    }
    if (event === 'SIGNED_OUT' || (session && owner && owner !== session.user.id)) {
      void unsubscribeHere();
    }
  });
  return () => data.subscription.unsubscribe();
}

/**
 * What the service worker tells the open app: a push arrived (refresh what's on screen) or a
 * notification was tapped (go there, without reloading). In `AppShell`.
 */
export function useServiceWorkerMessages() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: unknown } | null;
      if (data?.type === 'kachingga:push') void queryClient.invalidateQueries();
      if (data?.type === 'kachingga:navigate' && typeof data.path === 'string') {
        void navigate(data.path);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate, queryClient]);
}

/**
 * Opening the app with a session confirms this device (if it's this account's): its notifications go
 * on for another DEVICE_TTL_DAYS. A device nobody opens the app on stops getting them. In `AppShell`.
 */
export function useConfirmDevice() {
  const trpc = useTRPC();
  const userId = useSession()?.user.id;
  const { mutate } = useMutation(trpc.notifications.confirmDevice.mutationOptions());
  useEffect(() => {
    if (!userId || !onlineManager.isOnline()) return;
    let owner: string | null = null;
    try {
      owner = localStorage.getItem(OWNER_KEY);
    } catch {
      // Storage blocked: nothing to confirm
    }
    if (owner !== userId) return;
    void currentEndpoint().then((endpoint) => endpoint && mutate({ endpoint }));
  }, [userId, mutate]);
}

/** The unread count on the app icon (installed app, where the browser supports it). */
export function useAppBadge(count: number) {
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const done = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
    done.catch(() => {});
  }, [count]);
}
