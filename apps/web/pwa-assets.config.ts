import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Every app icon (favicon, PWA, maskable, apple-touch-icon) is generated from public/logo.svg at build time.
// iOS and Android crop their icons themselves: those two get a solid background (the logo's) instead of white.
const iconBackground = '#0C5C3C';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: iconBackground } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: iconBackground } },
  },
  images: ['public/logo.svg'],
});
