import {
  AllAppleDeviceNames,
  createAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

// Every app icon (favicon, PWA, maskable, apple-touch-icon) is generated from public/logo.svg at build time.
// iOS and Android crop their icons themselves: those two get a solid background (the logo's) instead of white.
const iconBackground = '#0C5C3C';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: iconBackground } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: iconBackground } },
    // Installed on an iPhone: the image shown while the app opens (`apple-touch-startup-image`), one
    // per screen size, light and dark: the logo on the app's background. Android builds its own from
    // the manifest. Not precached by the service worker (vite.config.ts): iOS fetches it when installing.
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.6,
        resizeOptions: { background: '#FAF6EE', fit: 'contain' },
        darkResizeOptions: { background: '#101A16', fit: 'contain' },
        linkMediaOptions: { log: false, addMediaScreen: true, xhtml: false },
      },
      AllAppleDeviceNames.filter((name) => name.startsWith('iPhone')),
    ),
  },
  images: ['public/logo.svg'],
});
