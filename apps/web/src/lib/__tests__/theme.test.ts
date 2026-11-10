import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { currentPalette, currentTheme, PALETTES, setPalette, setTheme } from '@/lib/theme';

function mockSystem(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: dark && query.includes('dark'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

describe('theme', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.palette;
    vi.restoreAllMocks();
  });

  it('follows the system when nothing was picked', () => {
    mockSystem(true);
    expect(currentTheme()).toBe('dark');
    mockSystem(false);
    expect(currentTheme()).toBe('light');
  });

  it('the toggle overrides the system and is remembered on the device', () => {
    mockSystem(false);
    setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(currentTheme()).toBe('dark');
    expect(localStorage.getItem('kachingga-theme')).toBe('dark');

    setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(currentTheme()).toBe('light');
  });
});

describe('public/theme.js (before the first paint)', () => {
  // Tests run from apps/web.
  const run = () => window.eval(readFileSync(resolve('public/theme.js'), 'utf8'));

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.palette;
    vi.restoreAllMocks();
  });

  it('applies what theme.ts saved, with the same keys', () => {
    mockSystem(false);
    setTheme('dark');
    setPalette('violet');
    document.documentElement.classList.remove('dark');
    delete document.documentElement.dataset.palette;

    run();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.palette).toBe('violet');
  });

  it('follows the system when nothing was picked, and ignores unknown palettes', () => {
    mockSystem(true);
    localStorage.setItem('kachingga-palette', 'rosa');

    run();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.palette).toBeUndefined();
  });
});

describe('palette', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.palette;
  });

  it('green by default, and the five to pick from', () => {
    expect(currentPalette()).toBe('green');
    expect(PALETTES.map((p) => p.name)).toEqual([
      'Verde',
      'Azul',
      'Violeta',
      'Amarillo',
      'Blanco y negro',
    ]);
  });

  it('the one picked is applied and remembered on the device', () => {
    setPalette('violet');
    expect(document.documentElement.dataset.palette).toBe('violet');
    expect(localStorage.getItem('kachingga-palette')).toBe('violet');
    expect(currentPalette()).toBe('violet');
  });

  it('an unknown saved value (old data) falls back to green', () => {
    localStorage.setItem('kachingga-palette', 'rosa');
    expect(currentPalette()).toBe('green');
  });
});
