// Notifications on the device (docs/claude/web/notificaciones.md). The service worker that
// vite-plugin-pwa generates imports this file (vite.config.ts → workbox.importScripts): it's plain
// JavaScript, outside the bundle. Tested in src/lib/__tests__/push-sw.test.ts.

// A push from the API (lib/push.ts → pushPayload): { title, body, url, tag, badge }. Every push has
// to show a notification (browsers take the permission away from pages that don't).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Unreadable: still a notification
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || 'Kachingga', {
        body: data.body || 'Tenés novedades',
        // One per group: the newest replaces the previous one
        tag: data.tag,
        icon: '/pwa-192x192.png',
        data: { url: data.url },
      });
      // The number on the app icon (installed app; where the browser supports it)
      if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
        await self.navigator.setAppBadge(data.badge).catch(() => {});
      }
      // An open app refreshes what it shows (the bell, the lists)
      const windows = await self.clients.matchAll({ type: 'window' });
      for (const client of windows) client.postMessage({ type: 'kachingga:push' });
    })(),
  );
});

// Tapping it opens what it's about: in the app if it's open (it navigates without reloading), or
// in a new window. Only paths of the app itself.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.url;
  const safe = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
  const url = new URL(safe ? path : '/novedades', self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === url.origin);
      if (open) {
        await open.focus();
        open.postMessage({ type: 'kachingga:navigate', path: url.pathname + url.search });
        return;
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
