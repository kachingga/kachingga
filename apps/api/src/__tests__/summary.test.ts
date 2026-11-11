import { describe, expect, test } from 'bun:test'
import { summarizeExpenses, summaryFromTotals } from '../lib/summary'

const food = { id: 'c-food', name: 'Comida' }
const transport = { id: 'c-transport', name: 'Transporte' }

describe('summarizeExpenses', () => {
  test('totals, my share and what I paid, per balance currency', () => {
    const result = summarizeExpenses('ARS', 'me', [
      {
        currency: 'ARS',
        exchangeRate: null,
        category: food,
        paidById: 'me',
        splits: [
          { participantId: 'me', amountCents: 500 },
          { participantId: 'x', amountCents: 500 },
        ],
      },
      { currency: 'USD', exchangeRate: 1555, category: transport, paidById: 'x', splits: [{ participantId: 'me', amountCents: 1000 }] },
      { currency: 'USD', exchangeRate: null, category: food, paidById: 'x', splits: [{ participantId: 'x', amountCents: 3000 }] },
    ])
    expect(result.map((r) => r.currency)).toEqual(['ARS', 'USD'])
    expect(result[0]).toEqual({
      currency: 'ARS',
      count: 2,
      totalCents: 1000 + 1_555_000,
      myShareCents: 500 + 1_555_000,
      myPaidCents: 1000,
      byCategory: [
        { categoryId: 'c-transport', name: 'Transporte', totalCents: 1_555_000 },
        { categoryId: 'c-food', name: 'Comida', totalCents: 1000 },
      ],
    })
    expect(result[1]).toMatchObject({ currency: 'USD', count: 1, totalCents: 3000, myShareCents: 0, myPaidCents: 0 })
  })

  test('categories with the same total go by name (the order the database returns them in does not matter)', () => {
    const total = (categoryId: string, name: string) => ({
      currency: 'ARS' as const,
      categoryId,
      name,
      count: 1,
      totalCents: 500,
      myShareCents: 0,
      myPaidCents: 0,
    })
    const [ars] = summaryFromTotals('ARS', [total('c2', 'Nafta'), total('c1', 'Comida'), total('c3', 'Alojamiento')])
    expect(ars!.byCategory.map((c) => c.name)).toEqual(['Alojamiento', 'Comida', 'Nafta'])
    expect(ars).toMatchObject({ count: 3, totalCents: 1500 })
  })

  test('no expenses → empty', () => {
    expect(summarizeExpenses('ARS', 'me', [])).toEqual([])
  })
})
