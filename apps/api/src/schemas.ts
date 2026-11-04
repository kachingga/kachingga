import { z } from 'zod'

// Shared with the app (`@kachingga/api/schemas`): keep this file free of server-only imports.

export const currencies = ['ARS', 'USD', 'EUR', 'BRL', 'UYU', 'CLP'] as const
export const expenseCategories = ['FOOD', 'GROCERIES', 'TRANSPORT', 'LODGING', 'ENTERTAINMENT', 'SHOPPING', 'SERVICES', 'OTHER'] as const

export const currency = z.enum(currencies)
// Where a suggested exchange rate comes from: blue (only USD, the default for it) or oficial
export const rateSource = z.enum(['blue', 'oficial'])
export const expenseCategory = z.enum(expenseCategories)

const id = z.string().min(1)
const name = z.string().trim().min(1).max(60)
// Postgres int4 limit (≈ 21.4M in the expense's currency)
const amountCents = z.number().int().positive().max(2_147_483_647)

export const splitInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('EQUAL'), participantIds: z.array(id).min(1) }),
  z.object({
    type: z.literal('AMOUNT'),
    shares: z.array(z.object({ participantId: id, amountCents: z.number().int().nonnegative() })).min(1),
  }),
  z.object({
    type: z.literal('PERCENTAGE'),
    shares: z.array(z.object({ participantId: id, percentage: z.number().positive().max(100) })).min(1),
  }),
])

// Currency of a movement (expense or settlement):
// - same as the group's base → no conversion
// - keepCurrency: true → settled in its own currency, separate balance
// - otherwise converted to base with exchangeRate (omitted → automatic blue midpoint for ARS ↔ USD)
const movementCurrency = {
  currency,
  exchangeRate: z.number().positive().nullish(),
  keepCurrency: z.boolean().default(false),
}

export const expenseInput = z.object({
  groupId: id,
  description: z.string().trim().min(1).max(120),
  category: expenseCategory.default('OTHER'),
  date: z.date(),
  amountCents,
  ...movementCurrency,
  paidById: id,
  split: splitInput,
})

export const settlementInput = z.object({
  groupId: id,
  fromId: id,
  toId: id,
  amountCents,
  ...movementCurrency,
  date: z.date(),
  note: z.string().trim().max(200).nullish(),
})

export const exportFormat = z.enum(['csv', 'json'])

export const expenseFilters = z.object({
  paidById: id.optional(),
  splitParticipantId: id.optional(),
  // paid it OR is part of the split ("gastos en los que estoy involucrado")
  involvedParticipantId: id.optional(),
  categories: z.array(expenseCategory).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  minAmountCents: z.number().int().nonnegative().optional(),
  maxAmountCents: z.number().int().nonnegative().optional(),
  search: z.string().trim().max(100).optional(),
})

export const groupInput = z.object({ name, baseCurrency: currency })
export const participantName = name

// Alias (6-20 letters, digits, dots or hyphens) or CVU/CBU (22 digits) to get paid by transfer.
// null = remove it.
export const paymentAlias = z
  .string()
  .trim()
  .regex(/^([a-zA-Z0-9.-]{6,20}|\d{22})$/, 'Alias (6 a 20 letras, números, puntos o guiones) o CVU/CBU (22 dígitos)')
  .nullable()

export type ExpenseInput = z.input<typeof expenseInput>
export type SettlementInput = z.input<typeof settlementInput>
export type ExpenseFilters = z.infer<typeof expenseFilters>
export type SplitInput = z.infer<typeof splitInput>
export type RateSource = z.infer<typeof rateSource>

// Shared with the app so its previews match what gets stored ("Redondeo" in the root CLAUDE.md).
// Spreads `total` across `weights` proportionally, in whole cents, always adding up to `total`.
// Leftover cents go to the largest fractional remainders (ties: input order).
export function distributeCents(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (total * w) / weightSum)
  const floors = exact.map(Math.floor)
  let leftover = total - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((value, index) => ({ index, remainder: value - floors[index]! }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of order) {
    if (leftover === 0) break
    floors[index]! += 1
    leftover -= 1
  }
  return floors
}
