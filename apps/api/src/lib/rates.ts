import { TRPCError } from '@trpc/server'
import type { Currency } from '../db/generated/prisma/enums'

export type DollarRate = { buy: number; sell: number; mid: number; updatedAt: string }
export type DollarKind = 'blue' | 'oficial'

const NAMES: Record<DollarKind, string> = { blue: 'del blue', oficial: 'del oficial' }
const CACHE_MS = 10 * 60 * 1000

const cache = new Map<DollarKind, { rate: DollarRate; fetchedAt: number }>()

export function parseDollarRate(data: unknown, kind: DollarKind = 'blue'): DollarRate {
  const { compra, venta, fechaActualizacion } = data as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown }
  if (typeof compra !== 'number' || typeof venta !== 'number') {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: `Respuesta inesperada de la cotización ${NAMES[kind]}` })
  }
  return { buy: compra, sell: venta, mid: (compra + venta) / 2, updatedAt: String(fechaActualizacion ?? '') }
}

// DolarApi: blue (the one dolarhoy.com shows, our default) or oficial. We use the midpoint between buy and sell.
export async function getDollarRate(kind: DollarKind): Promise<DollarRate> {
  const cached = cache.get(kind)
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.rate
  const response = await fetch(`https://dolarapi.com/v1/dolares/${kind}`, { signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!response?.ok) {
    throw new TRPCError({
      code: 'BAD_GATEWAY',
      message: `No se pudo obtener la cotización ${NAMES[kind]}. Cargá el tipo de cambio a mano.`,
    })
  }
  const rate = parseDollarRate(await response.json(), kind)
  cache.set(kind, { rate, fetchedAt: Date.now() })
  return rate
}

// Automatic rate from `from` to `to` (1 `from` = rate `to`): blue midpoint. Only ARS ↔ USD is automatic;
// for the oficial (or any other) the app sends it as `exchangeRate`.
export async function getAutomaticRate(from: Currency, to: Currency): Promise<number> {
  if (from === 'USD' && to === 'ARS') return (await getDollarRate('blue')).mid
  if (from === 'ARS' && to === 'USD') return 1 / (await getDollarRate('blue')).mid
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `No hay cotización automática para ${from} → ${to}. Cargá el tipo de cambio a mano.`,
  })
}

// Decides the stored exchangeRate for an expense/settlement (see the Expense model for the rules).
export async function resolveExchangeRate(input: {
  currency: Currency
  baseCurrency: Currency
  keepCurrency: boolean
  exchangeRate?: number | null
}): Promise<number | null> {
  if (input.currency === input.baseCurrency || input.keepCurrency) return null
  return input.exchangeRate ?? getAutomaticRate(input.currency, input.baseCurrency)
}
