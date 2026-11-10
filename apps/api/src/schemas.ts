import { z } from 'zod'

// Shared with the app (`@kachingga/api/schemas`): keep this file free of server-only imports.

export const currencies = ['ARS', 'USD', 'EUR', 'BRL', 'UYU', 'CLP'] as const

// Categories belong to each group (CLAUDE.md → "Gastos"): every group starts with these 8 and its
// members can add, rename, recolor or archive them. `key` marks the built-in ones (Category.defaultKey).
export const defaultCategories = [
  { key: 'FOOD', name: 'Comida', icon: 'utensils', color: 'tangerine' },
  { key: 'GROCERIES', name: 'Súper', icon: 'shopping-cart', color: 'lime' },
  { key: 'TRANSPORT', name: 'Transporte', icon: 'car', color: 'sky' },
  { key: 'LODGING', name: 'Alojamiento', icon: 'bed-double', color: 'indigo' },
  { key: 'ENTERTAINMENT', name: 'Salidas', icon: 'party-popper', color: 'raspberry' },
  { key: 'SHOPPING', name: 'Compras', icon: 'shopping-bag', color: 'grape' },
  { key: 'SERVICES', name: 'Servicios', icon: 'zap', color: 'mango' },
  { key: 'OTHER', name: 'Otros', icon: 'shapes', color: 'cocoa' },
] as const
export type DefaultCategoryKey = (typeof defaultCategories)[number]['key']

// Icons a category can have: lucide icon names (the app maps each one to its component).
export const categoryIcons = [
  'utensils',
  'shopping-cart',
  'car',
  'bed-double',
  'party-popper',
  'shopping-bag',
  'zap',
  'shapes',
  'fuel',
  'plane',
  'bus',
  'home',
  'gift',
  'heart',
  'coffee',
  'beer',
  'pizza',
  'shirt',
  'gamepad-2',
  'music',
  'film',
  'ticket',
  'dumbbell',
  'paw-print',
  'baby',
  'graduation-cap',
  'stethoscope',
  'pill',
  'wifi',
  'smartphone',
  'book',
  'briefcase',
  'wrench',
  'tree-pine',
  'sun',
  'wallet',
] as const
// Colors a category can have: names of theme colors (never hex: the app resolves them in light and dark).
export const categoryColors = [
  'tomato',
  'tangerine',
  'mango',
  'lime',
  'mint',
  'teal',
  'sky',
  'indigo',
  'grape',
  'raspberry',
  'pink',
  'cocoa',
] as const

export const currency = z.enum(currencies)
// Where a suggested exchange rate comes from: blue (only USD, the default for it) or oficial
export const rateSource = z.enum(['blue', 'oficial'])

const id = z.string().min(1)
const name = z.string().trim().min(1).max(60)

export const categoryIcon = z.enum(categoryIcons)
export const categoryColor = z.enum(categoryColors)
export const categoryName = z.string().trim().min(1).max(30)
export const categoryInput = z.object({ name: categoryName, icon: categoryIcon, color: categoryColor })
// Description being typed in the expense form, to suggest its category (`categories.suggest`)
export const categorySuggestionInput = z.object({ groupId: id, description: z.string().trim().min(1).max(120) })
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
// Cap for a manual exchange rate: far above any real one (ARS per USD is in the thousands) and low
// enough that amount × rate stays an exact integer (otherwise balances stop adding up to zero, or an
// infinite rate hangs the transfer calculation).
export const MAX_EXCHANGE_RATE = 1_000_000

const movementCurrency = {
  currency,
  exchangeRate: z.number().positive().max(MAX_EXCHANGE_RATE).nullish(),
  keepCurrency: z.boolean().default(false),
}

export const expenseInput = z.object({
  groupId: id,
  description: z.string().trim().min(1).max(120),
  // One of the group's categories; omitted → the group's "Otros"
  categoryId: id.optional(),
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
  categoryIds: z.array(id).optional(),
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

export type CategoryInput = z.infer<typeof categoryInput>
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
