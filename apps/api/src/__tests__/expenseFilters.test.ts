import { describe, expect, test } from 'bun:test'
import { buildExpenseWhere } from '../trpc/routers/expenses'

describe('buildExpenseWhere', () => {
  test('no filters → only the group and not deleted', () => {
    expect(buildExpenseWhere('g1', {})).toEqual({ groupId: 'g1', deletedAt: null })
  })

  test('combines every filter', () => {
    const dateFrom = new Date('2026-01-01')
    const where = buildExpenseWhere('g1', {
      paidById: 'p1',
      splitParticipantId: 'p2',
      categories: ['FOOD'],
      dateFrom,
      minAmountCents: 100,
      search: 'asado',
    })
    expect(where).toMatchObject({
      paidById: 'p1',
      splits: { some: { participantId: 'p2' } },
      category: { in: ['FOOD'] },
      date: { gte: dateFrom, lte: undefined },
      amountCents: { gte: 100, lte: undefined },
      description: { contains: 'asado', mode: 'insensitive' },
    })
  })

  test('empty category list is ignored', () => {
    expect(buildExpenseWhere('g1', { categories: [] })).toEqual({ groupId: 'g1', deletedAt: null })
  })
})
