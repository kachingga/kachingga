import { describe, expect, test } from 'bun:test'
import { summarizeExpenses } from '../lib/summary'

describe('summarizeExpenses', () => {
  test('totals, my share and what I paid, per balance currency', () => {
    const result = summarizeExpenses('ARS', 'me', [
      {
        currency: 'ARS',
        exchangeRate: null,
        category: 'FOOD',
        paidById: 'me',
        splits: [
          { participantId: 'me', amountCents: 500 },
          { participantId: 'x', amountCents: 500 },
        ],
      },
      { currency: 'USD', exchangeRate: 1555, category: 'TRANSPORT', paidById: 'x', splits: [{ participantId: 'me', amountCents: 1000 }] },
      { currency: 'USD', exchangeRate: null, category: 'FOOD', paidById: 'x', splits: [{ participantId: 'x', amountCents: 3000 }] },
    ])
    expect(result.map((r) => r.currency)).toEqual(['ARS', 'USD'])
    expect(result[0]).toEqual({
      currency: 'ARS',
      count: 2,
      totalCents: 1000 + 1_555_000,
      myShareCents: 500 + 1_555_000,
      myPaidCents: 1000,
      byCategory: [
        { category: 'TRANSPORT', totalCents: 1_555_000 },
        { category: 'FOOD', totalCents: 1000 },
      ],
    })
    expect(result[1]).toMatchObject({ currency: 'USD', count: 1, totalCents: 3000, myShareCents: 0, myPaidCents: 0 })
  })

  test('no expenses → empty', () => {
    expect(summarizeExpenses('ARS', 'me', [])).toEqual([])
  })
})
