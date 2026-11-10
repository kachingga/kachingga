import { afterEach, describe, expect, it } from 'vitest';

import {
  forgetReturnToFromGoogle,
  readReturnToFromGoogle,
  rememberReturnToForGoogle,
  safeReturnTo,
  withReturnTo,
} from '@/lib/return-to';

afterEach(() => sessionStorage.clear());

describe('safeReturnTo', () => {
  it('keeps paths inside the app', () => {
    expect(safeReturnTo('/grupos/unirme?codigo=ABCDEFGH')).toBe('/grupos/unirme?codigo=ABCDEFGH');
    expect(safeReturnTo('/grupos/g1/gastos?q=cena#total')).toBe('/grupos/g1/gastos?q=cena#total');
  });

  it('never sends to another site', () => {
    const evil = [
      'https://evil.com',
      '//evil.com',
      '/\\evil.com',
      '/\\/evil.com',
      // The browser ignores tabs and line breaks in a URL: these are //evil.com.
      '/\t/evil.com',
      '/\n/evil.com',
      '/\r\n/evil.com',
      '\t//evil.com',
      'javascript:alert(1)',
      '//',
      'evil.com',
      '',
      null,
      undefined,
    ];
    for (const value of evil) expect(safeReturnTo(value), JSON.stringify(value)).toBe('/grupos');
  });
});

describe('withReturnTo', () => {
  it('adds where to come back, except for the home', () => {
    expect(withReturnTo('/login', '/grupos/unirme?codigo=AB')).toBe(
      `/login?volver=${encodeURIComponent('/grupos/unirme?codigo=AB')}`,
    );
    expect(withReturnTo('/registro', '/grupos')).toBe('/registro');
    expect(withReturnTo('/login', '/')).toBe('/login');
  });
});

describe('Google round trip', () => {
  it('remembers the destination until it is read and forgotten', () => {
    rememberReturnToForGoogle('/grupos/unirme?codigo=AB');
    expect(readReturnToFromGoogle()).toBe('/grupos/unirme?codigo=AB');
    forgetReturnToFromGoogle();
    expect(readReturnToFromGoogle()).toBe('/grupos');
  });

  it('a tampered value falls back to the home', () => {
    sessionStorage.setItem('kachingga-volver', '//evil.com');
    expect(readReturnToFromGoogle()).toBe('/grupos');
  });
});
