// Registers the PWA's service worker (vite-plugin-pwa generates /sw.js; `injectRegister: false` in
// vite.config.ts, so this replaces its registerSW.js). Same as that script, but some browsers refuse
// the registration (private windows, blocked storage): the app works the same without it (no offline
// mode, not installable), so it's not an error to report to Sentry.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    },
    { once: true },
  );
}
