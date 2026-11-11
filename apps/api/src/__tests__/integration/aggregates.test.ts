// The API adds up balances and totals in SQL (lib/aggregates.ts): `groups.list`, `balances.get` and
// `expenses.summary`. They have to give exactly what the JS versions give on the same data
// (computeBalances in lib/balances.ts, summarizeExpenses in lib/summary.ts): same currency for each
// movement, each share and payment converted and rounded on its own (Math.round), same order.
// Random groups (fixed seed) with every kind of movement, plus the rounding edge cases.
import { describe, expect, test } from 'bun:test'
import type { Currency } from '../../db/generated/prisma/enums'
import { computeBalances } from '../../lib/balances'
import { summarizeExpenses } from '../../lib/summary'
import { buildExpenseWhere } from '../../trpc/routers/expenses'
import { currencies, type ExpenseFilters } from '../../schemas'
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
const USERS = ['ana', 'beto', 'carla', 'dani'].map((name) => `${name}-aggregates`)
const WORDS = ['cena', 'nafta', 'súper', 'Cena', 'peaje', 'regalo']
const N_GROUPS = 12

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
      categories: {
        create: ['Otros', 'Comida', 'Nafta'].map((name) => ({ name, icon: 'shapes', color: 'cocoa' })),
      },
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
        description: `${pick(WORDS)} ${i}`,
        categoryId: pick(group.categories).id,
        date: new Date(Date.UTC(2026, int(3), 1 + int(28), 12)),
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

// The JS version over every expense and payment of the group (what the API did before).
async function jsBalances(groupId: string) {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } })
  const [participants, expenses, settlements] = await Promise.all([
    prisma.participant.findMany({ where: { groupId }, select: { id: true } }),
    prisma.expense.findMany({
      where: { groupId, deletedAt: null },
      select: { currency: true, exchangeRate: true, paidById: true, splits: { select: { participantId: true, amountCents: true } } },
    }),
    prisma.settlement.findMany({
      where: { groupId, deletedAt: null },
      select: { currency: true, exchangeRate: true, fromId: true, toId: true, amountCents: true },
    }),
  ])
  return computeBalances(
    group.baseCurrency,
    participants.map((p) => p.id),
    expenses,
    settlements,
  )
}

async function jsMyBalances(userId: string, groupId: string) {
  const me = await prisma.participant.findFirstOrThrow({ where: { groupId, userId } })
  const myBalances = (await jsBalances(groupId)).map((b) => ({
    currency: b.currency,
    amountCents: b.balances.find((p) => p.participantId === me.id)!.amountCents,
  }))
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } })
  return {
    myBalanceCents: myBalances.find((b) => b.currency === group.baseCurrency)!.amountCents,
    myBalances: myBalances.filter((b) => b.amountCents !== 0),
  }
}

async function jsSummary(userId: string, groupId: string, filters: ExpenseFilters) {
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } })
  const me = await prisma.participant.findFirstOrThrow({ where: { groupId, userId } })
  const expenses = await prisma.expense.findMany({
    where: buildExpenseWhere(groupId, filters),
    select: {
      currency: true,
      exchangeRate: true,
      category: { select: { id: true, name: true } },
      paidById: true,
      splits: { select: { participantId: true, amountCents: true } },
    },
  })
  return summarizeExpenses(group.baseCurrency, me.id, expenses)
}

// Every group each user is in, after building them all.
const memberships = (async () => {
  for (let n = 0; n < N_GROUPS; n++) await randomGroup(n)
  const groups = await prisma.participant.findMany({ where: { userId: { in: USERS } }, select: { userId: true, groupId: true } })
  return groups.map((g) => ({ userId: g.userId!, groupId: g.groupId }))
})()

describe('sums in SQL = the JS versions', () => {
  test('the edge rate really is where FLOOR(x + 0.5) and Math.round disagree', () => {
    const x = 1 * 0.49999999999999994
    expect(Math.round(x)).toBe(0)
    expect(Math.floor(x + 0.5)).toBe(1)
  })

  test('groups.list: my balances, for everyone in every group', async () => {
    await memberships
    let compared = 0
    for (const userId of USERS) {
      for (const group of await caller(userId).groups.list({ includeArchived: true })) {
        expect({ myBalanceCents: group.myBalanceCents, myBalances: group.myBalances }).toEqual(await jsMyBalances(userId, group.id))
        compared += group.myBalances.length
      }
    }
    expect(compared).toBeGreaterThan(20) // the data really has balances in several currencies
  }, 60_000)

  test('balances.get: every balance and every transfer, in the same order', async () => {
    let currenciesCompared = 0
    for (const { userId, groupId } of await memberships) {
      const fromSql = await caller(userId).balances.get({ groupId })
      expect(fromSql).toEqual(await jsBalances(groupId))
      currenciesCompared += fromSql.length
    }
    expect(currenciesCompared).toBeGreaterThan(N_GROUPS * 3)
  }, 60_000)

  test('expenses.summary: the totals for any filters', async () => {
    let compared = 0
    for (const { userId, groupId } of await memberships) {
      const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId }, include: { participants: true, categories: true } })
      const someone = pick(group.participants).id
      const filters: ExpenseFilters[] = [
        {},
        { paidById: someone },
        { splitParticipantId: someone },
        { involvedParticipantId: someone },
        { categoryIds: [group.categories[1]!.id, group.categories[2]!.id] },
        { dateFrom: new Date('2026-02-01T00:00:00Z'), dateTo: new Date('2026-03-15T23:59:59.999Z') },
        { minAmountCents: 100, maxAmountCents: 1_000_000 },
        { search: 'cena' },
        { search: 'nada que coincida' },
      ]
      for (const f of filters) {
        const fromSql = await caller(userId).expenses.summary({ groupId, filters: f })
        expect(fromSql).toEqual(await jsSummary(userId, groupId, f))
        compared += fromSql.length
      }
    }
    expect(compared).toBeGreaterThan(N_GROUPS * 9)
  }, 120_000)

  test('a share of 1 cent at the edge rate counts as 0, like Math.round', async () => {
    const ana = caller('edge-aggregates')
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
    expect(await ana.balances.get({ groupId: group.id })).toEqual(await jsBalances(group.id))
    expect((await ana.balances.get({ groupId: group.id }))[0]!.balances.every((b) => b.amountCents === 0)).toBe(true)
    expect(await ana.expenses.summary({ groupId: group.id })).toMatchObject([{ currency: 'ARS', count: 1, totalCents: 0 }])
  })
})
