import { describe, expect, test } from 'bun:test'
import { resolveSplits } from '../lib/splits'

const sum = (splits: { amountCents: number }[]) => splits.reduce((a, s) => a + s.amountCents, 0)

describe('resolveSplits', () => {
  test('EQUAL splits evenly and gives leftover cents to the first participants', () => {
    const splits = resolveSplits(1000, { type: 'EQUAL', participantIds: ['a', 'b', 'c'] })
    expect(splits.map((s) => s.amountCents)).toEqual([334, 333, 333])
    expect(sum(splits)).toBe(1000)
  })

  test('AMOUNT keeps the given shares', () => {
    const splits = resolveSplits(1000, {
      type: 'AMOUNT',
      shares: [
        { participantId: 'a', amountCents: 700 },
        { participantId: 'b', amountCents: 300 },
      ],
    })
    expect(splits.map((s) => s.amountCents)).toEqual([700, 300])
  })

  test('AMOUNT rejects shares that do not add up', () => {
    expect(() =>
      resolveSplits(1000, {
        type: 'AMOUNT',
        shares: [
          { participantId: 'a', amountCents: 600 },
          { participantId: 'b', amountCents: 300 },
        ],
      }),
    ).toThrow('no coincide')
  })

  test('PERCENTAGE resolves to cents that add up to the total', () => {
    const splits = resolveSplits(1001, {
      type: 'PERCENTAGE',
      shares: [
        { participantId: 'a', percentage: 33.33 },
        { participantId: 'b', percentage: 33.33 },
        { participantId: 'c', percentage: 33.34 },
      ],
    })
    expect(sum(splits)).toBe(1001)
    expect(splits[2]!.percentage).toBe(33.34)
  })

  test('PERCENTAGE must add up to 100', () => {
    expect(() =>
      resolveSplits(1000, {
        type: 'PERCENTAGE',
        shares: [
          { participantId: 'a', percentage: 50 },
          { participantId: 'b', percentage: 40 },
        ],
      }),
    ).toThrow('100')
  })

  test('rejects repeated participants', () => {
    expect(() => resolveSplits(1000, { type: 'EQUAL', participantIds: ['a', 'a'] })).toThrow('repetidos')
  })
})
