import type { Currency, ExpenseCategory } from '../db/generated/prisma/enums'
import { balanceCurrency, type ExpenseForBalance } from './balances'

export type ExpenseForSummary = ExpenseForBalance & { category: ExpenseCategory }

export type CurrencySummary = {
  currency: Currency
  count: number
  totalCents: number // what the expenses cost in total
  myShareCents: number // my part of them ("cuánto gasté yo")
  myPaidCents: number // what I actually paid
  byCategory: { category: ExpenseCategory; totalCents: number }[] // biggest first
}

// Totals of a set of expenses, grouped by the balance they count in (same currency rules as balances:
// converted expenses add up in the base currency, kept ones in their own).
export function summarizeExpenses(baseCurrency: Currency, meId: string, expenses: ExpenseForSummary[]): CurrencySummary[] {
  const byCurrency = new Map<Currency, CurrencySummary & { categories: Map<ExpenseCategory, number> }>()

  for (const expense of expenses) {
    const { currency, rate } = balanceCurrency(expense, baseCurrency)
    let summary = byCurrency.get(currency)
    if (!summary) {
      summary = { currency, count: 0, totalCents: 0, myShareCents: 0, myPaidCents: 0, byCategory: [], categories: new Map() }
      byCurrency.set(currency, summary)
    }
    // Same rounding as computeBalances: convert each share, the total is their sum.
    const shares = expense.splits.map((s) => ({ participantId: s.participantId, cents: Math.round(s.amountCents * rate) }))
    const total = shares.reduce((a, s) => a + s.cents, 0)

    summary.count += 1
    summary.totalCents += total
    summary.myShareCents += shares.find((s) => s.participantId === meId)?.cents ?? 0
    if (expense.paidById === meId) summary.myPaidCents += total
    summary.categories.set(expense.category, (summary.categories.get(expense.category) ?? 0) + total)
  }

  return [...byCurrency.values()]
    .sort((a, b) => (a.currency === baseCurrency ? -1 : b.currency === baseCurrency ? 1 : a.currency.localeCompare(b.currency)))
    .map(({ categories, ...summary }) => ({
      ...summary,
      byCategory: [...categories.entries()]
        .map(([category, totalCents]) => ({ category, totalCents }))
        .sort((a, b) => b.totalCents - a.totalCents),
    }))
}
