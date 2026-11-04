import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  centsToNumeric,
  dayToDate,
  endOfDay,
  formatCents,
  formatDate,
  formatPlainAmount,
  monthRange,
  numberSeparators,
  startOfDay,
  toCents,
  toNumber,
  toNumeric,
  toDay,
  today,
} from '@/lib/format';

describe('locale formatting', () => {
  function asBrowser(language: string) {
    Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });
  }
  afterEach(() => asBrowser('es-AR'));

  it('follows the browser language', () => {
    expect(formatCents(150050, 'ARS')).toBe('$\u00a01.500,50');
    expect(numberSeparators()).toEqual({ group: '.', decimal: ',' });
    expect(formatPlainAmount(150050)).toBe('1500,50');

    asBrowser('en-US');
    expect(formatCents(150050, 'USD')).toBe('$1,500.50');
    expect(numberSeparators()).toEqual({ group: ',', decimal: '.' });
    expect(formatPlainAmount(150050)).toBe('1500.50');
    expect(formatDate(dayToDate('2026-11-04'))).toBe('11/4/2026');
  });

  it('always shows debts with their cents', () => {
    expect(formatCents(-777550, 'ARS')).toBe('-$\u00a07.775,50');
    expect(formatCents(100, 'ARS')).toBe('$\u00a01,00');
  });
});

describe('normalized numbers', () => {
  it('converts between numeric strings and cents', () => {
    expect(toCents('1500.5')).toBe(150050);
    expect(toCents('19.99')).toBe(1999);
    expect(toCents('')).toBe(0);
    expect(centsToNumeric(150050)).toBe('1500.5');
    expect(toNumber('')).toBeNull();
    expect(toNumber('0.000643')).toBe(0.000643);
    expect(toNumeric(1 / 1555)).toBe('0.000643');
  });
});

describe('calendar days', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it('today is the local day, even late at night in Argentina (UTC-3)', () => {
    process.env.TZ = 'America/Argentina/Buenos_Aires';
    vi.useFakeTimers();
    // 22:00 on Nov 4 in Buenos Aires = 01:00 UTC on Nov 5.
    vi.setSystemTime(new Date('2026-11-05T01:00:00Z'));
    expect(today()).toBe('2026-11-04');
  });

  it('today is the local day in a time zone ahead of UTC too', () => {
    process.env.TZ = 'Asia/Tokyo';
    vi.useFakeTimers();
    // 08:00 on Nov 5 in Tokyo = 23:00 UTC on Nov 4.
    vi.setSystemTime(new Date('2026-11-04T23:00:00Z'));
    expect(today()).toBe('2026-11-05');
  });

  it('stores a day at 12:00 UTC and reads it back as the same day', () => {
    const date = dayToDate('2026-11-04');
    expect(date.toISOString()).toBe('2026-11-04T12:00:00.000Z');
    expect(toDay(date)).toBe('2026-11-04');
    expect(formatDate(date)).toBe('4/11/2026');
  });

  it('reads old dates saved at Argentine noon as the same day', () => {
    expect(toDay(new Date('2026-11-04T15:00:00Z'))).toBe('2026-11-04');
    expect(formatDate(new Date('2026-11-04T15:00:00Z'))).toBe('4/11/2026');
  });

  it('builds filter ranges that cover the whole day', () => {
    expect(startOfDay('2026-11-04').toISOString()).toBe('2026-11-04T00:00:00.000Z');
    expect(endOfDay('2026-11-04').toISOString()).toBe('2026-11-04T23:59:59.999Z');
    expect(toDay(endOfDay('2026-11-30'))).toBe('2026-11-30');
  });

  it('gives the first and last day of a month', () => {
    expect(monthRange('2026-11-04')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});
