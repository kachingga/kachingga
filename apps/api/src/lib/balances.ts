import type { Currency } from '../db/generated/prisma/enums'

type Movement = {
  currency: Currency
  exchangeRate: number | null
}

export type ExpenseForBalance = Movement & {
  paidById: string
  splits: { participantId: string; amountCents: number }[]
}

export type SettlementForBalance = Movement & {
  fromId: string
  toId: string
  amountCents: number
}

export type Transfer = { fromId: string; toId: string; amountCents: number }

export type CurrencyBalance = {
  currency: Currency
  // positive = the group owes them; negative = they owe the group
  balances: { participantId: string; amountCents: number }[]
  transfers: Transfer[]
}

// Which balance a movement counts in, and the factor to convert its amounts to that currency.
export function balanceCurrency(movement: Movement, baseCurrency: Currency): { currency: Currency; rate: number } {
  if (movement.currency === baseCurrency) return { currency: baseCurrency, rate: 1 }
  if (movement.exchangeRate != null) return { currency: baseCurrency, rate: movement.exchangeRate }
  return { currency: movement.currency, rate: 1 }
}

// Greedy: the biggest debtor pays the biggest creditor, and so on down both lists (sorted once, so
// it stays fast with many people). Each transfer settles at least one of the two: at most n - 1.
export function minimizeTransfers(balances: { participantId: string; amountCents: number }[]): Transfer[] {
  // A non-finite balance never reaches zero and would loop forever, blocking the whole API.
  if (balances.some((b) => !Number.isFinite(b.amountCents))) throw new Error('Non-finite balance')
  const byAmount = (a: { amountCents: number }, b: { amountCents: number }) => b.amountCents - a.amountCents
  const creditors = balances.filter((b) => b.amountCents > 0).map((b) => ({ ...b }))
  const debtors = balances.filter((b) => b.amountCents < 0).map((b) => ({ ...b, amountCents: -b.amountCents }))
  creditors.sort(byAmount)
  debtors.sort(byAmount)
  const transfers: Transfer[] = []

  let c = 0
  let d = 0
  while (c < creditors.length && d < debtors.length) {
    const creditor = creditors[c]!
    const debtor = debtors[d]!
    const amountCents = Math.min(creditor.amountCents, debtor.amountCents)

    transfers.push({ fromId: debtor.participantId, toId: creditor.participantId, amountCents })
    creditor.amountCents -= amountCents
    debtor.amountCents -= amountCents
    if (creditor.amountCents === 0) c += 1
    if (debtor.amountCents === 0) d += 1
  }
  return transfers
}

// Each participant's total in a balance currency: what computeBalances adds up here in JS, and what
// lib/aggregates.ts adds up in the database (balances.get).
export type BalanceTotal = { currency: Currency; participantId: string; amountCents: number }

// The rules in JS: which balance each movement counts in, converted and rounded share by share.
// The API adds them up in SQL (lib/aggregates.ts) and the tests compare both on the same data.
export function computeBalances(
  baseCurrency: Currency,
  participantIds: string[],
  expenses: ExpenseForBalance[],
  settlements: SettlementForBalance[],
): CurrencyBalance[] {
  const totals: BalanceTotal[] = []
  const add = (currency: Currency, participantId: string, amountCents: number) => totals.push({ currency, participantId, amountCents })

  for (const expense of expenses) {
    const { currency, rate } = balanceCurrency(expense, baseCurrency)
    // Convert each share and credit the payer with the sum, so every expense nets to exactly zero.
    let paid = 0
    for (const split of expense.splits) {
      const share = Math.round(split.amountCents * rate)
      add(currency, split.participantId, -share)
      paid += share
    }
    add(currency, expense.paidById, paid)
  }

  for (const settlement of settlements) {
    const { currency, rate } = balanceCurrency(settlement, baseCurrency)
    const cents = Math.round(settlement.amountCents * rate)
    add(currency, settlement.fromId, cents)
    add(currency, settlement.toId, -cents)
  }

  return currencyBalances(baseCurrency, participantIds, totals)
}

// One entry per currency with movements (base first, always there): every participant's balance, in
// the order of `participantIds`, and the suggested transfers.
export function currencyBalances(baseCurrency: Currency, participantIds: string[], totals: BalanceTotal[]): CurrencyBalance[] {
  const byCurrency = new Map<Currency, Map<string, number>>()
  for (const { currency, participantId, amountCents } of totals) {
    let ledger = byCurrency.get(currency)
    if (!ledger) {
      ledger = new Map(participantIds.map((id) => [id, 0]))
      byCurrency.set(currency, ledger)
    }
    ledger.set(participantId, (ledger.get(participantId) ?? 0) + amountCents)
  }

  if (!byCurrency.has(baseCurrency)) byCurrency.set(baseCurrency, new Map(participantIds.map((id) => [id, 0])))

  return [...byCurrency.entries()]
    .sort(([a], [b]) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : a.localeCompare(b)))
    .map(([currency, ledger]) => {
      const balances = [...ledger.entries()].map(([participantId, amountCents]) => ({ participantId, amountCents }))
      return { currency, balances, transfers: minimizeTransfers(balances) }
    })
}
