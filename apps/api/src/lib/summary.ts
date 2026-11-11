import type { Currency } from '../db/generated/prisma/enums'
import { balanceCurrency, type ExpenseForBalance } from './balances'

export type ExpenseForSummary = ExpenseForBalance & { category: { id: string; name: string } }

export type CurrencySummary = {
  currency: Currency
  count: number
  totalCents: number // what the expenses cost in total
  myShareCents: number // my part of them ("cuánto gasté yo")
  myPaidCents: number // what I actually paid
  byCategory: { categoryId: string; name: string; totalCents: number }[] // biggest first
}

// What a set of expenses adds up to in one balance currency and category: what summarizeExpenses
// adds up here in JS, and what lib/aggregates.ts adds up in the database (expenses.summary).
export type CategoryTotal = {
  currency: Currency
  categoryId: string
  name: string
  count: number
  totalCents: number
  myShareCents: number
  myPaidCents: number
}

// Totals of a set of expenses, grouped by the balance they count in (same currency rules as balances:
// converted expenses add up in the base currency, kept ones in their own). The rules in JS: the API
// adds them up in SQL (lib/aggregates.ts) and the tests compare both on the same data.
export function summarizeExpenses(baseCurrency: Currency, meId: string, expenses: ExpenseForSummary[]): CurrencySummary[] {
  const totals = new Map<string, CategoryTotal>()

  for (const expense of expenses) {
    const { currency, rate } = balanceCurrency(expense, baseCurrency)
    // Same rounding as computeBalances: convert each share, the total is their sum.
    const shares = expense.splits.map((s) => ({ participantId: s.participantId, cents: Math.round(s.amountCents * rate) }))
    const total = shares.reduce((a, s) => a + s.cents, 0)

    const key = `${currency}:${expense.category.id}`
    const entry = totals.get(key) ?? {
      currency,
      categoryId: expense.category.id,
      name: expense.category.name,
      count: 0,
      totalCents: 0,
      myShareCents: 0,
      myPaidCents: 0,
    }
    entry.count += 1
    entry.totalCents += total
    entry.myShareCents += shares.find((s) => s.participantId === meId)?.cents ?? 0
    if (expense.paidById === meId) entry.myPaidCents += total
    totals.set(key, entry)
  }

  return summaryFromTotals(baseCurrency, [...totals.values()])
}

// One entry per balance currency (base first), with its categories biggest first (same total: by name).
export function summaryFromTotals(baseCurrency: Currency, totals: CategoryTotal[]): CurrencySummary[] {
  const byCurrency = new Map<Currency, CurrencySummary>()
  for (const t of totals) {
    const summary = byCurrency.get(t.currency) ?? {
      currency: t.currency,
      count: 0,
      totalCents: 0,
      myShareCents: 0,
      myPaidCents: 0,
      byCategory: [],
    }
    summary.count += t.count
    summary.totalCents += t.totalCents
    summary.myShareCents += t.myShareCents
    summary.myPaidCents += t.myPaidCents
    summary.byCategory.push({ categoryId: t.categoryId, name: t.name, totalCents: t.totalCents })
    byCurrency.set(t.currency, summary)
  }

  return [...byCurrency.values()]
    .sort((a, b) => (a.currency === baseCurrency ? -1 : b.currency === baseCurrency ? 1 : a.currency.localeCompare(b.currency)))
    .map((summary) => ({
      ...summary,
      byCategory: summary.byCategory.sort(
        (a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name) || a.categoryId.localeCompare(b.categoryId),
      ),
    }))
}
