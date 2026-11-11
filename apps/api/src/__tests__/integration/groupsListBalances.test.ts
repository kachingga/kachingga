// `groups.list` adds up my balances in SQL (myBalancesByGroup in routers/groups.ts). It has to give
// exactly what computeBalances (lib/balances.ts) gives on the same data: same currency for each
// movement, each share and payment converted and rounded on its own (Math.round), base first.
// Random groups (fixed seed) with every kind of movement, plus the rounding edge cases.
import { describe, expect, test } from 'bun:test'
import type { Currency } from '../../db/generated/prisma/enums'
import { computeBalances } from '../../lib/balances'
import { currencies } from '../../schemas'
import { setupTestApi } from './setup'

const { caller, prisma } = await setupTestApi()

// Deterministic random numbers (mulberry32), so a failure can be reproduced.
let seed = 142
function random() {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!
const int = (max: number) => Math.floor(random() * max)

// Rates that make shares land on .5, just below it (0.49999999999999994 is where FLOOR(x + 0.5)
// and Math.round disagree), tiny and huge.
const RATES = [1555.5, 1545, 0.5, 2.5, 1.5, 1 / 3, 0.000643, 1234.5678, 0.1, 1_000_000, 0.49999999999999994, 0.7]
const USERS = ['ana', 'beto', 'carla', 'dani'].map((name) => `${name}-balances`)

// A movement's currency and rate as the API stores them: base → no rate; other → converted or kept.
function money(base: Currency) {
  const currency = pick(currencies)
  return { currency, exchangeRate: currency === base || random() < 0.4 ? null : pick(RATES) }
}

// Splits `total` in `parts` random non-negative pieces (shares can be 0 in a split by amount).
function pieces(total: number, parts: number) {
  const cuts = Array.from({ length: parts - 1 }, () => int(total + 1)).sort((a, b) => a - b)
  return [...cuts, total].map((cut, i) => cut - (i === 0 ? 0 : cuts[i - 1]!))
}

async function randomGroup(n: number) {
  const base = pick(currencies)
  const members = USERS.filter(() => random() < 0.7)
  const group = await prisma.group.create({
    data: {
      name: `Grupo ${n}`,
      baseCurrency: base,
      inviteCode: `CODE${n}`.padEnd(8, 'X'),
      createdById: members[0] ?? USERS[0]!,
      participants: {
        create: [
          ...(members.length ? members : [USERS[0]!]).map((userId) => ({ name: userId, userId })),
          ...Array.from({ length: 1 + int(4) }, (_, i) => ({ name: `Sin cuenta ${i}` })),
        ],
      },
      categories: { create: { name: 'Otros', icon: 'shapes', color: 'cocoa' } },
    },
    include: { participants: true, categories: true },
  })
  const people = group.participants.map((p) => p.id)

  for (let i = 0; i < 60; i++) {
    const amountCents = pick([1, 2, 3, 99, 101, 1000, 12_345, 2_147_483_647, 1 + int(5_000_000)])
    const sharers = people.filter(() => random() < 0.6)
    if (sharers.length === 0) sharers.push(pick(people))
    const shares = pieces(amountCents, sharers.length)
    await prisma.expense.create({
      data: {
        groupId: group.id,
        description: `Gasto ${i}`,
        categoryId: group.categories[0]!.id,
        date: new Date('2026-11-01T12:00:00Z'),
        amountCents,
        ...money(base),
        splitType: 'AMOUNT',
        paidById: pick(people),
        createdById: USERS[0]!,
        deletedAt: random() < 0.1 ? new Date() : null,
        splits: { create: sharers.map((participantId, j) => ({ participantId, amountCents: shares[j]! })) },
      },
    })
  }
  for (let i = 0; i < 30; i++) {
    const fromId = pick(people)
    const toId = pick(people.filter((p) => p !== fromId))
    await prisma.settlement.create({
      data: {
        groupId: group.id,
        fromId,
        toId,
        amountCents: pick([1, 3, 50, 1 + int(1_000_000)]),
        ...money(base),
        date: new Date('2026-11-02T12:00:00Z'),
        createdById: USERS[0]!,
        deletedAt: random() < 0.1 ? new Date() : null,
      },
    })
  }
}

// What groups.list returned before: computeBalances over every expense and payment of the group.
async function expected(userId: string, groupId: string) {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId }, include: { participants: true } })
  const me = group.participants.find((p) => p.userId === userId)!
  const [expenses, settlements] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId, deletedAt: null },
      select: { currency: true, exchangeRate: true, paidById: true, splits: { select: { participantId: true, amountCents: true } } },
    }),
    prisma.settlement.findMany({
      where: { groupId, deletedAt: null },
      select: { currency: true, exchangeRate: true, fromId: true, toId: true, amountCents: true },
    }),
  ])
  const myBalances = computeBalances(group.baseCurrency, [me.id], expenses, settlements).map((b) => ({
    currency: b.currency,
    amountCents: b.balances.find((p) => p.participantId === me.id)!.amountCents,
  }))
  return {
    myBalanceCents: myBalances.find((b) => b.currency === group.baseCurrency)!.amountCents,
    myBalances: myBalances.filter((b) => b.amountCents !== 0),
  }
}

describe('groups.list: my balances from SQL = computeBalances', () => {
  test('the edge rate really is where FLOOR(x + 0.5) and Math.round disagree', () => {
    const x = 1 * 0.49999999999999994
    expect(Math.round(x)).toBe(0)
    expect(Math.floor(x + 0.5)).toBe(1)
  })

  test('same balances for everyone, in every group', async () => {
    for (let n = 0; n < 12; n++) await randomGroup(n)
    let compared = 0
    for (const userId of USERS) {
      for (const group of await caller(userId).groups.list({ includeArchived: true })) {
        expect({ myBalanceCents: group.myBalanceCents, myBalances: group.myBalances }).toEqual(await expected(userId, group.id))
        compared += group.myBalances.length
      }
    }
    expect(compared).toBeGreaterThan(20) // the data really has balances in several currencies
  }, 60_000)

  test('a share of 1 cent at the edge rate counts as 0, like Math.round', async () => {
    const ana = caller('edge-balances')
    const group = await ana.groups.create({ name: 'Borde', baseCurrency: 'ARS', myName: 'Ana' })
    const juan = await ana.participants.add({ groupId: group.id, name: 'Juan' })
    const me = (await ana.groups.get({ groupId: group.id })).myParticipantId
    const base = { groupId: group.id, description: 'x', date: new Date('2026-11-01T12:00:00Z'), currency: 'USD' as const }
    await ana.expenses.create({
      ...base,
      amountCents: 2,
      exchangeRate: 0.49999999999999994,
      paidById: juan.id,
      split: { type: 'EQUAL', participantIds: [me, juan.id] },
    })
    const [listed] = await ana.groups.list()
    expect(listed).toMatchObject({ myBalanceCents: 0, myBalances: [] })
    expect(await expected('edge-balances', group.id)).toEqual({ myBalanceCents: 0, myBalances: [] })
  })
})
