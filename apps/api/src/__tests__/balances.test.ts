import { describe, expect, test } from 'bun:test'
import { balanceCurrency, computeBalances, minimizeTransfers } from '../lib/balances'

const balanceOf = (result: ReturnType<typeof computeBalances>[number], id: string) =>
  result.balances.find((b) => b.participantId === id)!.amountCents

describe('balanceCurrency', () => {
  test('base currency counts in base', () => {
    expect(balanceCurrency({ currency: 'ARS', exchangeRate: null }, 'ARS')).toEqual({ currency: 'ARS', rate: 1 })
  })
  test('foreign currency with rate is converted to base', () => {
    expect(balanceCurrency({ currency: 'USD', exchangeRate: 1555 }, 'ARS')).toEqual({ currency: 'ARS', rate: 1555 })
  })
  test('foreign currency without rate keeps its own balance', () => {
    expect(balanceCurrency({ currency: 'USD', exchangeRate: null }, 'ARS')).toEqual({ currency: 'USD', rate: 1 })
  })
})

describe('computeBalances', () => {
  test('payer is owed what the others consumed', () => {
    const [ars] = computeBalances(
      'ARS',
      ['a', 'b', 'c'],
      [
        {
          currency: 'ARS',
          exchangeRate: null,
          paidById: 'a',
          splits: [
            { participantId: 'a', amountCents: 1000 },
            { participantId: 'b', amountCents: 1000 },
            { participantId: 'c', amountCents: 1000 },
          ],
        },
      ],
      [],
    )
    expect(ars!.currency).toBe('ARS')
    expect(balanceOf(ars!, 'a')).toBe(2000)
    expect(balanceOf(ars!, 'b')).toBe(-1000)
    expect(ars!.transfers).toEqual([
      { fromId: 'b', toId: 'a', amountCents: 1000 },
      { fromId: 'c', toId: 'a', amountCents: 1000 },
    ])
  })

  test('converted USD expense lands in the ARS balance at the given rate', () => {
    const [ars, ...rest] = computeBalances(
      'ARS',
      ['a', 'b'],
      [
        {
          currency: 'USD',
          exchangeRate: 1555,
          paidById: 'a',
          splits: [
            { participantId: 'a', amountCents: 1000 },
            { participantId: 'b', amountCents: 1000 },
          ],
        },
      ],
      [],
    )
    expect(rest).toHaveLength(0)
    expect(balanceOf(ars!, 'b')).toBe(-1_555_000) // USD 10 → ARS 15.550
  })

  test('native USD expense gets its own balance, base still listed first', () => {
    const result = computeBalances(
      'ARS',
      ['a', 'b'],
      [{ currency: 'USD', exchangeRate: null, paidById: 'a', splits: [{ participantId: 'b', amountCents: 5000 }] }],
      [],
    )
    expect(result.map((r) => r.currency)).toEqual(['ARS', 'USD'])
    expect(balanceOf(result[1]!, 'b')).toBe(-5000)
    expect(result[0]!.transfers).toEqual([])
  })

  test('settlements reduce debt', () => {
    const [ars] = computeBalances(
      'ARS',
      ['a', 'b'],
      [{ currency: 'ARS', exchangeRate: null, paidById: 'a', splits: [{ participantId: 'b', amountCents: 1000 }] }],
      [{ currency: 'ARS', exchangeRate: null, fromId: 'b', toId: 'a', amountCents: 400 }],
    )
    expect(balanceOf(ars!, 'b')).toBe(-600)
    expect(balanceOf(ars!, 'a')).toBe(600)
  })

  test('every currency balance nets to zero even with rounding', () => {
    const result = computeBalances(
      'ARS',
      ['a', 'b', 'c'],
      [
        {
          currency: 'USD',
          exchangeRate: 1555.37,
          paidById: 'c',
          splits: [
            { participantId: 'a', amountCents: 334 },
            { participantId: 'b', amountCents: 333 },
            { participantId: 'c', amountCents: 333 },
          ],
        },
      ],
      [],
    )
    for (const r of result) expect(r.balances.reduce((a, b) => a + b.amountCents, 0)).toBe(0)
  })
})

describe('minimizeTransfers', () => {
  test('throws instead of looping forever on a non-finite balance', () => {
    expect(() =>
      minimizeTransfers([
        { participantId: 'a', amountCents: Infinity },
        { participantId: 'b', amountCents: -Infinity },
      ]),
    ).toThrow('Non-finite balance')
  })
  test('settles everything with at most n - 1 transfers', () => {
    const balances = [
      { participantId: 'a', amountCents: 5000 },
      { participantId: 'b', amountCents: -2000 },
      { participantId: 'c', amountCents: -2000 },
      { participantId: 'd', amountCents: -1000 },
    ]
    const transfers = minimizeTransfers(balances)
    expect(transfers.length).toBeLessThanOrEqual(3)
    const net = new Map(balances.map((b) => [b.participantId, b.amountCents]))
    for (const t of transfers) {
      net.set(t.fromId, net.get(t.fromId)! + t.amountCents)
      net.set(t.toId, net.get(t.toId)! - t.amountCents)
    }
    expect([...net.values()].every((v) => v === 0)).toBe(true)
  })

  test('nothing to do when everyone is even', () => {
    expect(minimizeTransfers([{ participantId: 'a', amountCents: 0 }])).toEqual([])
  })
})
