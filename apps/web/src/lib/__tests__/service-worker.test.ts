import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerServiceWorker } from '@/lib/service-worker';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('registerServiceWorker', () => {
  it('registers /sw.js on load and swallows a refused registration', async () => {
    vi.stubEnv('PROD', true);
    const register = vi.fn().mockRejectedValue(new Error('Rejected'));
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } });
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    registerServiceWorker();
    window.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it('does nothing outside the production build', () => {
    const register = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } });
    registerServiceWorker();
    window.dispatchEvent(new Event('load'));
    expect(register).not.toHaveBeenCalled();
  });
});
