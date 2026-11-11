// Balances and totals added up in the database, without bringing every share of every expense to the
// API (a full group: 5.000 expenses among 25 people). The same rules as the JS versions, which stay as
// the reference: computeBalances (lib/balances.ts) and summarizeExpenses (lib/summary.ts).
// aggregates.test.ts compares both on the same data: if a rule changes, both change.
import { Prisma } from '../db/generated/prisma/client'
import type { Currency } from '../db/generated/prisma/enums'
import { prisma } from '../db'
import type { BalanceTotal } from './balances'
import type { CategoryTotal } from './summary'

// SQL pieces. Only constant names go in them (Prisma.raw): never anything from a request.

// balanceCurrency: the balance a movement (row `t` of Expense or Settlement) counts in, given its
// group's base currency (`base`): converted → base, kept → its own currency.
const inBalance = (t: string, base: string) =>
  Prisma.raw(`CASE WHEN ${t}."currency" <> ${base} AND ${t}."exchangeRate" IS NOT NULL THEN ${base} ELSE ${t}."currency" END`)
// …and the factor that converts its amounts to that currency.
const rateOf = (t: string, base: string) =>
  Prisma.raw(`CASE WHEN ${t}."currency" <> ${base} AND ${t}."exchangeRate" IS NOT NULL THEN ${t}."exchangeRate" ELSE 1 END`)
// Math.round (half up) of an amount ≥ 0, as bigint. Not FLOOR(x + 0.5): adding 0.5 rounds
// 0.49999999999999994 up, while x - FLOOR(x) is exact for x ≥ 0.
const rounded = (x: string) => Prisma.raw(`(CASE WHEN ${x} - FLOOR(${x}) >= 0.5::float8 THEN CEIL(${x}) ELSE FLOOR(${x}) END)::bigint`)

/**
 * My balance in each of these groups and currencies (what computeBalances gives for my participant):
 * + every share of the expenses I paid and the payments I made, − my shares and the payments I got.
 * Only touches the splits of the expenses I paid and my own ones (groups.list).
 */
export async function myBalancesByGroup(userId: string, groupIds: string[]) {
  const byGroup = new Map<string, Map<Currency, number>>()
  if (groupIds.length === 0) return byGroup
  const rows = await prisma.$queryRaw<{ groupId: string; currency: Currency; amountCents: bigint }[]>`
    WITH me AS (
      SELECT p."id" AS pid, p."groupId" AS gid, g."baseCurrency" AS base
      FROM "Participant" p JOIN "Group" g ON g."id" = p."groupId"
      WHERE p."userId" = ${userId} AND p."groupId" IN (${Prisma.join(groupIds)})
    ),
    expense AS (
      SELECT e."id", me.gid, me.pid, e."paidById", ${inBalance('e', 'me.base')} AS currency, ${rateOf('e', 'me.base')} AS rate
      FROM "Expense" e JOIN me ON e."groupId" = me.gid
      WHERE e."deletedAt" IS NULL
    ),
    movement AS (
      SELECT x.gid, x.currency, s."amountCents" * x.rate AS amount, 1 AS sign
      FROM expense x JOIN "ExpenseSplit" s ON s."expenseId" = x."id"
      WHERE x."paidById" = x.pid
      UNION ALL
      SELECT x.gid, x.currency, s."amountCents" * x.rate, -1
      FROM expense x JOIN "ExpenseSplit" s ON s."expenseId" = x."id" AND s."participantId" = x.pid
      UNION ALL
      SELECT me.gid, ${inBalance('t', 'me.base')}, t."amountCents" * ${rateOf('t', 'me.base')}, CASE WHEN t."fromId" = me.pid THEN 1 ELSE -1 END
      FROM "Settlement" t JOIN me ON t."groupId" = me.gid
      WHERE t."deletedAt" IS NULL AND me.pid IN (t."fromId", t."toId")
    )
    SELECT gid AS "groupId", currency::text AS currency, SUM(sign * ${rounded('amount')})::bigint AS "amountCents"
    FROM movement
    GROUP BY gid, currency`
  for (const row of rows) {
    const balances = byGroup.get(row.groupId) ?? new Map<Currency, number>()
    balances.set(row.currency, Number(row.amountCents))
    byGroup.set(row.groupId, balances)
  }
  return byGroup
}

/**
 * Every participant's total in each balance currency of a group (balances.get, with currencyBalances):
 * + the shares of what they paid and the payments they made, − their shares and the payments they got.
 * A currency with movements is there even if everyone nets to zero, like in computeBalances.
 */
export async function groupBalanceTotals(groupId: string): Promise<BalanceTotal[]> {
  const rows = await prisma.$queryRaw<{ currency: Currency; participantId: string; amountCents: bigint }[]>`
    WITH share AS (
      SELECT ${inBalance('e', 'g."baseCurrency"')} AS currency, e."paidById", s."participantId",
        s."amountCents" * ${rateOf('e', 'g."baseCurrency"')} AS amount
      FROM "Expense" e JOIN "Group" g ON g."id" = e."groupId" JOIN "ExpenseSplit" s ON s."expenseId" = e."id"
      WHERE e."groupId" = ${groupId} AND e."deletedAt" IS NULL
    ),
    payment AS (
      SELECT ${inBalance('t', 'g."baseCurrency"')} AS currency, t."fromId", t."toId",
        t."amountCents" * ${rateOf('t', 'g."baseCurrency"')} AS amount
      FROM "Settlement" t JOIN "Group" g ON g."id" = t."groupId"
      WHERE t."groupId" = ${groupId} AND t."deletedAt" IS NULL
    ),
    movement AS (
      SELECT currency, "paidById" AS pid, amount, 1 AS sign FROM share
      UNION ALL SELECT currency, "participantId", amount, -1 FROM share
      UNION ALL SELECT currency, "fromId", amount, 1 FROM payment
      UNION ALL SELECT currency, "toId", amount, -1 FROM payment
    )
    SELECT currency::text AS currency, pid AS "participantId", SUM(sign * ${rounded('amount')})::bigint AS "amountCents"
    FROM movement
    GROUP BY currency, pid`
  return rows.map((r) => ({ currency: r.currency, participantId: r.participantId, amountCents: Number(r.amountCents) }))
}

/**
 * What these expenses (of one group) add up to in each balance currency and category, for
 * `meId` (expenses.summary, with summaryFromTotals): how many, their total (the sum of the converted
 * shares), my share and what I paid.
 */
export async function expenseCategoryTotals(meId: string, expenseIds: string[]): Promise<CategoryTotal[]> {
  if (expenseIds.length === 0) return []
  const rows = await prisma.$queryRaw<
    { currency: Currency; categoryId: string; name: string; count: number; total: bigint; mine: bigint; paid: bigint }[]
  >`
    WITH share AS (
      SELECT e."id", ${inBalance('e', 'g."baseCurrency"')} AS currency, e."categoryId", e."paidById", s."participantId",
        s."amountCents" * ${rateOf('e', 'g."baseCurrency"')} AS amount
      FROM "Expense" e JOIN "Group" g ON g."id" = e."groupId" JOIN "ExpenseSplit" s ON s."expenseId" = e."id"
      WHERE e."id" IN (${Prisma.join(expenseIds)})
    ),
    expense AS (
      SELECT "id", currency, "categoryId", "paidById",
        SUM(${rounded('amount')}) AS total,
        SUM(CASE WHEN "participantId" = ${meId} THEN ${rounded('amount')} ELSE 0 END) AS mine
      FROM share
      GROUP BY "id", currency, "categoryId", "paidById"
    )
    SELECT x.currency::text AS currency, x."categoryId", c."name", COUNT(*)::int AS count,
      SUM(x.total)::bigint AS total, SUM(x.mine)::bigint AS mine,
      SUM(CASE WHEN x."paidById" = ${meId} THEN x.total ELSE 0 END)::bigint AS paid
    FROM expense x JOIN "Category" c ON c."id" = x."categoryId"
    GROUP BY x.currency, x."categoryId", c."name"`
  return rows.map((r) => ({
    currency: r.currency,
    categoryId: r.categoryId,
    name: r.name,
    count: r.count,
    totalCents: Number(r.total),
    myShareCents: Number(r.mine),
    myPaidCents: Number(r.paid),
  }))
}
