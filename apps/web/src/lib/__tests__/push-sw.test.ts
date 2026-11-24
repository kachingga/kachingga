// The service worker's notification handlers (public/push-sw.js), run against a fake `self`.
import { describe, expect, it, vi } from 'vitest';

import source from '../../../public/push-sw.js?raw';

type Handler = (event: Record<string, unknown>) => void;

function serviceWorker({ windows = [] as { url: string }[] } = {}) {
  const handlers: Record<string, Handler> = {};
  const clients = windows.map((w) => ({
    ...w,
    focus: vi.fn(async () => {}),
    postMessage: vi.fn(),
  }));
  const self = {
    addEventListener: (type: string, handler: Handler) => (handlers[type] = handler),
    location: { origin: 'https://app.kachingga.com' },
    registration: { showNotification: vi.fn(async () => {}) },
    navigator: { setAppBadge: vi.fn(async () => {}) },
    clients: { matchAll: vi.fn(async () => clients), openWindow: vi.fn(async () => null) },
  };
  // Same as importScripts: the file's code with `self` as the service worker
  new Function('self', source)(self);
  /** Fires an event and waits for what it passed to waitUntil. */
  const fire = async (type: string, event: Record<string, unknown>) => {
    let work: Promise<unknown> = Promise.resolve();
    handlers[type]!({ ...event, waitUntil: (p: Promise<unknown>) => (work = p) });
    await work;
  };
  return { self, clients, fire };
}

const pushEvent = (payload: unknown) => ({ data: { json: () => payload } });

describe('push-sw.js', () => {
  it('shows the notification, sets the number on the icon and tells the open app', async () => {
    const sw = serviceWorker({ windows: [{ url: 'https://app.kachingga.com/grupos' }] });
    await sw.fire(
      'push',
      pushEvent({
        title: 'Bariloche',
        body: 'Román agregó «Cena»',
        url: '/grupos/g1/gastos/e1',
        tag: 'g1',
        badge: 3,
      }),
    );
    expect(sw.self.registration.showNotification).toHaveBeenCalledWith('Bariloche', {
      body: 'Román agregó «Cena»',
      tag: 'g1',
      icon: '/pwa-192x192.png',
      data: { url: '/grupos/g1/gastos/e1' },
    });
    expect(sw.self.navigator.setAppBadge).toHaveBeenCalledWith(3);
    expect(sw.clients[0]!.postMessage).toHaveBeenCalledWith({ type: 'kachingga:push' });
  });

  it('an unreadable push still shows one (browsers revoke the permission otherwise)', async () => {
    const sw = serviceWorker();
    await sw.fire('push', {
      data: {
        json: () => {
          throw new SyntaxError('bad');
        },
      },
    });
    expect(sw.self.registration.showNotification).toHaveBeenCalledWith(
      'Kachingga',
      expect.objectContaining({ body: 'Tenés notificaciones nuevas' }),
    );
  });

  it('tapping it goes there in the open app, without reloading', async () => {
    const sw = serviceWorker({ windows: [{ url: 'https://app.kachingga.com/grupos' }] });
    const close = vi.fn();
    await sw.fire('notificationclick', {
      notification: { close, data: { url: '/grupos/g1/pagos' } },
    });
    expect(close).toHaveBeenCalled();
    expect(sw.clients[0]!.focus).toHaveBeenCalled();
    expect(sw.clients[0]!.postMessage).toHaveBeenCalledWith({
      type: 'kachingga:navigate',
      path: '/grupos/g1/pagos',
    });
    expect(sw.self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('without the app open, opens it there', async () => {
    const sw = serviceWorker();
    await sw.fire('notificationclick', {
      notification: { close: vi.fn(), data: { url: '/notificaciones' } },
    });
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith(
      'https://app.kachingga.com/notificaciones',
    );
  });

  it('only paths of the app: anything else opens the notifications screen', async () => {
    for (const url of [
      'https://evil.example/x',
      '//evil.example/x',
      'javascript:alert(1)',
      undefined,
    ]) {
      const sw = serviceWorker();
      await sw.fire('notificationclick', { notification: { close: vi.fn(), data: { url } } });
      expect(sw.self.clients.openWindow).toHaveBeenCalledWith(
        'https://app.kachingga.com/notificaciones',
      );
    }
  });
});
