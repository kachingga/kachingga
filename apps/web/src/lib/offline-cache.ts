import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { MutationCache, onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import superjson from 'superjson';

import { supabase } from '@/lib/supabase';

// Offline mode (read-only): the TanStack Query cache is saved in localStorage, one entry per user,
// so the app can show the last data it fetched when there's no connection. Not the service worker:
// that one only caches the app's files. Details: docs/claude/web/datos-y-cache.md → "Offline".

const CACHE_PREFIX = 'kachingga-cache:';
const LAST_USER_KEY = 'kachingga-cache-user';

/** How long a saved cache is valid. Queries keep their data in memory at least this long (gcTime). */
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const OFFLINE_MESSAGE = 'Necesitás conexión para guardar';

// Bumped every time the saved caches are deleted: a persister created before stops saving. Saves are
// throttled, so one still pending would write back what was just deleted.
let deletions = 0;

/** Saves and restores one user's cache. superjson keeps Dates as Dates (like the API link). */
export function createPersister(userId: string, throttleTime = 1000) {
  const storage = window.localStorage;
  const createdAfter = deletions;
  return createSyncStoragePersister({
    storage: {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => {
        if (deletions === createdAfter) storage.setItem(key, value);
      },
      removeItem: (key) => storage.removeItem(key),
    },
    key: CACHE_PREFIX + userId,
    serialize: (client) => superjson.stringify(client),
    deserialize: (value) => superjson.parse(value),
    throttleTime,
  });
}

/** The user whose cache is on this device (to show it offline, when the session can't be refreshed). */
export function cachedUser(): string | null {
  try {
    return window.localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function rememberCachedUser(userId: string) {
  try {
    window.localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // Storage blocked (private mode): offline mode just won't have data.
  }
}

/** Deletes every saved cache on this device. Called when the session ends, by any path. */
export function clearOfflineCache() {
  deletions++;
  try {
    const storage = window.localStorage;
    for (const key of Object.keys(storage)) {
      if (key.startsWith(CACHE_PREFIX)) storage.removeItem(key);
    }
    storage.removeItem(LAST_USER_KEY);
  } catch {
    // Nothing saved if storage isn't available.
  }
}

/** Deletes the caches of everyone but `userId` (another account was used on this device). */
function clearOtherUsersCaches(userId: string) {
  try {
    const storage = window.localStorage;
    for (const key of Object.keys(storage)) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_PREFIX + userId) storage.removeItem(key);
    }
  } catch {
    // Nothing saved if storage isn't available.
  }
}

/**
 * Keeps the saved caches in step with the session. Called once at startup (`main.tsx`), before
 * Supabase can fire anything. When the session ends by any path (signing out here, or closed on
 * another device and the library finds out when refreshing the token) every cache is deleted; with
 * a session, only that user's is kept. Offline with an expired token there's no SIGNED_OUT (the
 * library keeps the session), so the read-only offline mode keeps working.
 */
export function syncOfflineCacheWithSession() {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') clearOfflineCache();
    else if (session) clearOtherUsersCaches(session.user.id);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Offline is read-only: a mutation without connection fails right away (before its optimistic
 * update) instead of staying paused and being sent later. The screens show the error as usual.
 */
export function createMutationCache(onError?: (error: unknown) => void) {
  return new MutationCache({
    onMutate: () => {
      if (!onlineManager.isOnline()) throw new Error(OFFLINE_MESSAGE);
    },
    onError,
  });
}

/**
 * TanStack Query assumes it's online until the browser fires `offline`, so an app opened without
 * connection would think it has one. Called once at startup (`main.tsx`). Only "offline" is trusted:
 * `navigator.onLine === true` can be wrong, `false` isn't.
 */
export function syncOnlineAtStartup() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    onlineManager.setOnline(false);
}

/** Whether there's connection, as TanStack Query sees it (follows the browser's online/offline). */
export function useOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
