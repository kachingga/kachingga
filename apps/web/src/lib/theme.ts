import { useSyncExternalStore } from 'react';

// Light / dark theme. By default it follows the system; the toggle saves an override in this
// device. The `.dark` class on <html> is what the CSS reads (index.css). public/theme.js applies
// the same logic before the first paint, so there's no flash: keep both in sync (same storage key).

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'kachingga-theme';
const listeners = new Set<() => void>();

function systemTheme(): Theme {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function savedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

/** The theme in use: the one picked with the toggle, or the system's. */
export function currentTheme(): Theme {
  return savedTheme() ?? systemTheme();
}

function apply() {
  document.documentElement.classList.toggle('dark', currentTheme() === 'dark');
  listeners.forEach((listener) => listener());
}

/** Saves the choice on this device and applies it. */
export function setTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode): it applies until the app is reloaded.
  }
  document.documentElement.classList.toggle('dark', theme === 'dark');
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Without an override, follow the system when it changes (e.g. automatic dark mode at night).
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener('change', apply);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener('change', apply);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'light');
}

// ─── Palette ──────────────────────────────────────────────────────────────────
// The app's colors (green by default), picked in Mi cuenta and saved on this device, like the
// light / dark toggle. `data-palette` on <html> is what the CSS reads (index.css → "Palettes");
// public/theme.js applies it before the first paint too (same storage key).

export const PALETTES = [
  { id: 'green', name: 'Verde' },
  { id: 'blue', name: 'Azul' },
  { id: 'violet', name: 'Violeta' },
  { id: 'yellow', name: 'Amarillo' },
  { id: 'mono', name: 'Blanco y negro' },
] as const;

export type Palette = (typeof PALETTES)[number]['id'];

const PALETTE_KEY = 'kachingga-palette';
const paletteListeners = new Set<() => void>();

/** The palette in use: the one picked on this device, or green. */
export function currentPalette(): Palette {
  try {
    const value = window.localStorage.getItem(PALETTE_KEY);
    return PALETTES.find((p) => p.id === value)?.id ?? 'green';
  } catch {
    return 'green';
  }
}

/** Saves the choice on this device and applies it. */
export function setPalette(palette: Palette) {
  try {
    window.localStorage.setItem(PALETTE_KEY, palette);
  } catch {
    // Storage blocked (private mode): it applies until the app is reloaded.
  }
  document.documentElement.dataset.palette = palette;
  paletteListeners.forEach((listener) => listener());
}

export function usePalette(): Palette {
  return useSyncExternalStore(
    (listener) => {
      paletteListeners.add(listener);
      return () => paletteListeners.delete(listener);
    },
    () => (document.documentElement.dataset.palette as Palette | undefined) ?? currentPalette(),
    () => 'green',
  );
}
