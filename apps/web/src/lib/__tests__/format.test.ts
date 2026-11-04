import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  centsToDisplay,
  dayToDate,
  endOfDay,
  formatDate,
  monthRange,
  parseCents,
  parseDecimal,
  startOfDay,
  toDay,
  today,
} from '@/lib/format';

describe('parseDecimal / parseCents', () => {
  it.each([
    ['1500', 1500],
    ['1.500', 1500],
    ['1.500,50', 1500.5],
    ['1.500.000', 1500000],
    ['1500,5', 1500.5],
    ['1500.50', 1500.5],
    ['12.5', 12.5],
    ['0.500', 0.5],
    ['0,5', 0.5],
    [',5', 0.5],
    ['1,500.50', 1500.5],
    [' 1.555 ', 1555],
    ['0.000643', 0.000643],
  ])('"%s" → %s', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each(['', 'abc', '1,5,5', '1.50.0', '-5', '1e3'])('"%s" is not a number', (input) => {
    expect(parseDecimal(input)).toBeNull();
  });

  it('turns Argentine amounts into cents', () => {
    expect(parseCents('1.500')).toBe(150000);
    expect(parseCents('1.500,50')).toBe(150050);
    expect(parseCents('nada')).toBe(0);
  });

  it('round-trips what it shows in inputs', () => {
    expect(centsToDisplay(150050)).toBe('1500,50');
    expect(parseCents(centsToDisplay(150050))).toBe(150050);
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
