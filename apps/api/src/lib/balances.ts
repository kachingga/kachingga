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

// Greedy: repeatedly match the biggest debtor with the biggest creditor. At most n - 1 transfers.
export function minimizeTransfers(balances: { participantId: string; amountCents: number }[]): Transfer[] {
  const creditors = balances.filter((b) => b.amountCents > 0).map((b) => ({ ...b }))
  const debtors = balances.filter((b) => b.amountCents < 0).map((b) => ({ ...b, amountCents: -b.amountCents }))
  const transfers: Transfer[] = []

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.amountCents - a.amountCents)
    debtors.sort((a, b) => b.amountCents - a.amountCents)
    const creditor = creditors[0]!
    const debtor = debtors[0]!
    const amountCents = Math.min(creditor.amountCents, debtor.amountCents)

    transfers.push({ fromId: debtor.participantId, toId: creditor.participantId, amountCents })
    creditor.amountCents -= amountCents
    debtor.amountCents -= amountCents
    if (creditor.amountCents === 0) creditors.shift()
    if (debtor.amountCents === 0) debtors.shift()
  }
  return transfers
}

export function computeBalances(
  baseCurrency: Currency,
  participantIds: string[],
  expenses: ExpenseForBalance[],
  settlements: SettlementForBalance[],
): CurrencyBalance[] {
  const byCurrency = new Map<Currency, Map<string, number>>()
  const add = (currency: Currency, participantId: string, cents: number) => {
    let ledger = byCurrency.get(currency)
    if (!ledger) {
      ledger = new Map(participantIds.map((id) => [id, 0]))
      byCurrency.set(currency, ledger)
    }
    ledger.set(participantId, (ledger.get(participantId) ?? 0) + cents)
  }

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

  if (!byCurrency.has(baseCurrency)) byCurrency.set(baseCurrency, new Map(participantIds.map((id) => [id, 0])))

  return [...byCurrency.entries()]
    .sort(([a], [b]) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : a.localeCompare(b)))
    .map(([currency, ledger]) => {
      const balances = [...ledger.entries()].map(([participantId, amountCents]) => ({ participantId, amountCents }))
      return { currency, balances, transfers: minimizeTransfers(balances) }
    })
}
