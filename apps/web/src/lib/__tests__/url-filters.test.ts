import { describe, expect, it } from 'vitest';

import { endOfDay, startOfDay } from '@/lib/format';
import { fromApiFilters, readUrlFilters, toApiFilters, writeUrlFilters } from '@/lib/url-filters';

describe('url filters', () => {
  it('round-trips every filter through the URL', () => {
    const filters = {
      paidById: 'p1',
      splitParticipantId: 'p2',
      involvedParticipantId: 'p3',
      categoryIds: ['cat-food', 'cat-transport'],
      dateFrom: '2026-11-01',
      dateTo: '2026-11-30',
      minAmount: '1500.5',
      maxAmount: '20000',
      search: 'cena',
    };
    const params = writeUrlFilters(filters);
    expect(params.toString()).toBe(
      'pago=p1&para=p2&involucrado=p3&categorias=cat-food%2Ccat-transport&desde=2026-11-01&hasta=2026-11-30&min=1500.5&max=20000&q=cena',
    );
    expect(readUrlFilters(params)).toEqual(filters);
  });

  it('turns them into what the API takes', () => {
    expect(
      toApiFilters({ dateFrom: '2026-11-01', dateTo: '2026-11-30', minAmount: '1500.5' }),
    ).toEqual({
      dateFrom: startOfDay('2026-11-01'),
      dateTo: endOfDay('2026-11-30'),
      minAmountCents: 150050,
    });
    expect(toApiFilters({})).toEqual({});
  });

  it('reads a saved filter back into the URL shape', () => {
    expect(
      fromApiFilters({
        dateFrom: startOfDay('2026-11-01'),
        maxAmountCents: 2000000,
        categoryIds: ['cat-food'],
      }),
    ).toEqual({
      dateFrom: '2026-11-01',
      maxAmount: '20000',
      categoryIds: ['cat-food'],
    });
  });

  it('ignores malformed values from a hand-edited link', () => {
    const params = new URLSearchParams('desde=ayer&min=-5&max=abc&categorias=cat-food,%20,&q=%20');
    expect(readUrlFilters(params)).toEqual({ categoryIds: ['cat-food'] });
  });
});
