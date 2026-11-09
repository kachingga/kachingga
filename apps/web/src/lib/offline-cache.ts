import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { MutationCache, onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import superjson from 'superjson';

// Offline mode (read-only): the TanStack Query cache is saved in localStorage, one entry per user,
// so the app can show the last data it fetched when there's no connection. Not the service worker:
// that one only caches the app's files. Details: docs/claude/web/datos-y-cache.md → "Offline".

const CACHE_PREFIX = 'kachingga-cache:';
const LAST_USER_KEY = 'kachingga-cache-user';

/** How long a saved cache is valid. Queries keep their data in memory at least this long (gcTime). */
export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const OFFLINE_MESSAGE = 'Necesitás conexión para guardar';

/** Saves and restores one user's cache. superjson keeps Dates as Dates (like the API link). */
export function createPersister(userId: string, throttleTime = 1000) {
  return createSyncStoragePersister({
    storage: window.localStorage,
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

/** Deletes every saved cache on this device. Called on sign out. */
export function clearOfflineCache() {
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
