import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PushDeviceCard } from '@/components/push-device-card';
import { renderWithApi } from '@/test/render';

vi.mock('@/lib/auth', () => ({ useSession: () => ({ user: { id: 'u1' } }) }));

// A VAPID public key: 65 bytes, base64url
const PUBLIC_KEY = 'B' + 'A'.repeat(86);
const NEW_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/new';

/** What jsdom doesn't have: service worker, PushManager, Notification. */
function fakeBrowser({
  permission = 'default' as NotificationPermission,
  answer = 'granted' as NotificationPermission,
  existing = null as string | null,
} = {}) {
  const subscriptionFor = (endpoint: string) => ({
    endpoint,
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({ endpoint, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
  });
  let current = existing ? subscriptionFor(existing) : null;
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => (current = subscriptionFor(NEW_ENDPOINT))),
  };
  const registration = { pushManager };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration, ready: Promise.resolve(registration) },
  });
  vi.stubGlobal('PushManager', function PushManager() {});
  const notification = {
    permission,
    requestPermission: vi.fn(async () => (notification.permission = answer)),
  };
  vi.stubGlobal('Notification', notification);
  return { pushManager, notification, current: () => current };
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  localStorage.clear();
});

const api = (extra = {}) => ({
  'notifications.pushConfig': () => ({ publicKey: PUBLIC_KEY }),
  'notifications.deviceStatus': () => ({ subscribed: true }),
  ...extra,
});

describe('PushDeviceCard (Mi cuenta)', () => {
  it('hidden when the API has notifications on the devices off', async () => {
    fakeBrowser();
    const pushConfig = vi.fn(() => ({ publicKey: null }));
    renderWithApi(<PushDeviceCard />, {
      'notifications.pushConfig': pushConfig,
    });
    await waitFor(() => expect(pushConfig).toHaveBeenCalled());
    expect(
      screen.queryByText(/Notificaciones en este dispositivo|¿Te avisamos/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('off: "Activar" asks for permission, subscribes this browser and tells the API', async () => {
    const browser = fakeBrowser();
    const subscribeDevice = vi.fn(() => ({ ok: true }));
    renderWithApi(<PushDeviceCard />, api({ 'notifications.subscribeDevice': subscribeDevice }));

    expect(await screen.findByText('Desactivadas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));

    await waitFor(() =>
      expect(subscribeDevice).toHaveBeenCalledWith({
        endpoint: NEW_ENDPOINT,
        keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) },
      }),
    );
    expect(browser.notification.requestPermission).toHaveBeenCalled();
    expect(browser.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(await screen.findByText('Activadas')).toBeInTheDocument();
    expect(localStorage.getItem('kachingga-push-user')).toBe('u1');
  });

  it("if the person doesn't allow them, nothing is subscribed and it says they're blocked", async () => {
    const browser = fakeBrowser({ answer: 'denied' });
    const subscribeDevice = vi.fn(() => ({ ok: true }));
    renderWithApi(<PushDeviceCard />, api({ 'notifications.subscribeDevice': subscribeDevice }));
    await userEvent.click(await screen.findByRole('button', { name: 'Activar' }));
    expect(await screen.findByText(/Las bloqueaste en este navegador/)).toBeInTheDocument();
    expect(browser.pushManager.subscribe).not.toHaveBeenCalled();
    expect(subscribeDevice).not.toHaveBeenCalled();
  });

  it('on: "Desactivar" tells the API and unsubscribes this browser', async () => {
    const browser = fakeBrowser({
      permission: 'granted',
      existing: 'https://fcm.googleapis.com/fcm/send/mine',
    });
    const subscription = browser.current()!;
    const unsubscribeDevice = vi.fn(() => ({ ok: true }));
    renderWithApi(
      <PushDeviceCard />,
      api({ 'notifications.unsubscribeDevice': unsubscribeDevice }),
    );

    expect(await screen.findByText('Activadas')).toBeInTheDocument();
    expect(screen.getByText(/Silenciar notificaciones/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));

    await waitFor(() =>
      expect(unsubscribeDevice).toHaveBeenCalledWith({
        endpoint: 'https://fcm.googleapis.com/fcm/send/mine',
      }),
    );
    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
    expect(await screen.findByText('Desactivadas')).toBeInTheDocument();
  });

  it("a browser subscription the API doesn't have counts as off", async () => {
    fakeBrowser({ permission: 'granted', existing: 'https://fcm.googleapis.com/fcm/send/rotated' });
    renderWithApi(
      <PushDeviceCard />,
      api({ 'notifications.deviceStatus': () => ({ subscribed: false }) }),
    );
    expect(await screen.findByText('Desactivadas')).toBeInTheDocument();
  });

  it('blocked in this browser: how to allow them', async () => {
    fakeBrowser({ permission: 'denied' });
    renderWithApi(<PushDeviceCard />, api());
    expect(await screen.findByText(/Las bloqueaste en este navegador/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
  });

  it('iPhone without the app installed: how to install it', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    );
    renderWithApi(<PushDeviceCard />, api());
    expect(await screen.findByText(/Agregar a inicio/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('a browser without notifications', async () => {
    renderWithApi(<PushDeviceCard />, api());
    expect(
      await screen.findByText('Este navegador no puede recibir notificaciones.'),
    ).toBeInTheDocument();
  });
});

describe('PushDeviceCard prompt (notifications screen)', () => {
  it('offers them while they are off here', async () => {
    fakeBrowser();
    renderWithApi(<PushDeviceCard prompt />, api());
    expect(await screen.findByText('¿Te avisamos en este dispositivo?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activar' })).toBeInTheDocument();
  });

  it('nothing once they are on, or blocked', async () => {
    fakeBrowser({ permission: 'granted', existing: 'https://fcm.googleapis.com/fcm/send/mine' });
    const deviceStatus = vi.fn(() => ({ subscribed: true }));
    renderWithApi(<PushDeviceCard prompt />, api({ 'notifications.deviceStatus': deviceStatus }));
    await waitFor(() => expect(deviceStatus).toHaveBeenCalled());
    expect(
      screen.queryByText(/Notificaciones en este dispositivo|¿Te avisamos/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
