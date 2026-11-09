import { afterEach, describe, expect, it, vi } from 'vitest';

import { currentTheme, setTheme } from '@/lib/theme';

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
