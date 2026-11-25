import { afterEach, describe, expect, it, vi } from 'vitest';

// Supabase's auth events, by hand
const listeners: ((event: string, session: { user: { id: string } } | null) => void)[] = [];
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (listener: (typeof listeners)[number]) => {
        listeners.push(listener);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));

// Whose session is open (useConfirmDevice)
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('@/lib/auth', () => ({ useSession: () => session.current }));

const {
  keyToBytes,
  pushSupport,
  subscribeHere,
  SUBSCRIBE_TIMEOUT_MS,
  syncPushWithSession,
  useConfirmDevice,
} = await import('@/lib/push');
const { renderWithApi } = await import('@/test/render');

function ConfirmDevice() {
  useConfirmDevice();
  return null;
}

/** A browser subscribed to notifications. */
function subscribedBrowser() {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/x',
    unsubscribe: vi.fn(async () => true),
  };
  const shown = [{ close: vi.fn() }, { close: vi.fn() }];
  const registration = {
    pushManager: { getSubscription: async () => subscription },
    getNotifications: async () => shown,
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration },
  });
  return Object.assign(subscription, { shown });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  localStorage.clear();
  listeners.length = 0;
});

describe('pushSupport', () => {
  const capable = (permission: NotificationPermission) => {
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} });
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.stubGlobal('Notification', { permission });
  };

  it('available, or blocked by the person', () => {
    capable('default');
    expect(pushSupport()).toBe('available');
    capable('denied');
    expect(pushSupport()).toBe('denied');
  });

  it('an iPhone or iPad without the app installed (no PushManager in Safari) needs it installed', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    );
    expect(pushSupport()).toBe('needs-install');
  });

  it('any other browser without notifications', () => {
    expect(pushSupport()).toBe('unsupported');
  });
});

describe('keyToBytes', () => {
  it('base64url → bytes', () => {
    expect([...keyToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239]);
  });
});

describe('syncPushWithSession', () => {
  it('when the session ends, this browser stops getting notifications', async () => {
    const subscription = subscribedBrowser();
    localStorage.setItem('kachingga-push-user', 'ana');
    syncPushWithSession();
    const clearAppBadge = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clearAppBadge', { configurable: true, value: clearAppBadge });
    listeners[0]!('SIGNED_OUT', null);
    await vi.waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
    expect(localStorage.getItem('kachingga-push-user')).toBeNull();
    // What was still on screen goes too: the notifications and the number on the icon
    await vi.waitFor(() => expect(clearAppBadge).toHaveBeenCalled());
    for (const notification of subscription.shown) expect(notification.close).toHaveBeenCalled();
    Reflect.deleteProperty(navigator, 'clearAppBadge');
  });

  it("another account on this browser doesn't get the previous one's", async () => {
    const subscription = subscribedBrowser();
    localStorage.setItem('kachingga-push-user', 'ana');
    syncPushWithSession();
    listeners[0]!('SIGNED_IN', { user: { id: 'beto' } });
    await vi.waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
  });

  it('the same account: nothing changes', async () => {
    const subscription = subscribedBrowser();
    localStorage.setItem('kachingga-push-user', 'ana');
    syncPushWithSession();
    listeners[0]!('TOKEN_REFRESHED', { user: { id: 'ana' } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    expect(localStorage.getItem('kachingga-push-user')).toBe('ana');
  });
});

describe('subscribeHere', () => {
  it('a browser that never answers fails after a while instead of loading forever', async () => {
    vi.useFakeTimers();
    try {
      // No service worker ever ready (like `bun run dev`), permission granted
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { ready: new Promise(() => {}) },
      });
      vi.stubGlobal('Notification', { requestPermission: async () => 'granted' });
      const attempt = subscribeHere('B' + 'A'.repeat(86), 'ana');
      const outcome = expect(attempt).rejects.toThrow('El navegador no respondió');
      await vi.advanceTimersByTimeAsync(SUBSCRIBE_TIMEOUT_MS);
      await outcome;
    } finally {
      vi.useRealTimers();
    }
  });

  it('without permission, nothing is subscribed', async () => {
    vi.stubGlobal('Notification', { requestPermission: async () => 'denied' });
    expect(await subscribeHere('B' + 'A'.repeat(86), 'ana')).toBeNull();
    expect(localStorage.getItem('kachingga-push-user')).toBeNull();
  });
});

describe('useConfirmDevice', () => {
  it("opening the app with this account's session confirms this device", async () => {
    subscribedBrowser();
    localStorage.setItem('kachingga-push-user', 'ana');
    session.current = { user: { id: 'ana' } };
    const confirmDevice = vi.fn(() => ({ subscribed: true }));
    renderWithApi(<ConfirmDevice />, { 'notifications.confirmDevice': confirmDevice });
    await vi.waitFor(() =>
      expect(confirmDevice).toHaveBeenCalledWith({
        endpoint: 'https://fcm.googleapis.com/fcm/send/x',
      }),
    );
    session.current = null;
  });

  it("not with another account's session, nor without one", async () => {
    subscribedBrowser();
    localStorage.setItem('kachingga-push-user', 'ana');
    const confirmDevice = vi.fn(() => ({ subscribed: true }));
    session.current = { user: { id: 'beto' } };
    renderWithApi(<ConfirmDevice />, { 'notifications.confirmDevice': confirmDevice });
    session.current = null;
    renderWithApi(<ConfirmDevice />, { 'notifications.confirmDevice': confirmDevice });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(confirmDevice).not.toHaveBeenCalled();
  });
});
