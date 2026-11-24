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

const { keyToBytes, pushSupport, subscribeHere, SUBSCRIBE_TIMEOUT_MS, syncPushWithSession } =
  await import('@/lib/push');

/** A browser subscribed to notifications. */
function subscribedBrowser() {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/x',
    unsubscribe: vi.fn(async () => true),
  };
  const registration = { pushManager: { getSubscription: async () => subscription } };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration },
  });
  return subscription;
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
    listeners[0]!('SIGNED_OUT', null);
    await vi.waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
    expect(localStorage.getItem('kachingga-push-user')).toBeNull();
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
