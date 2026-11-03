import { TRPCError } from '@trpc/server'
import type { Currency } from '../db/generated/prisma/enums'

export type BlueRate = { buy: number; sell: number; mid: number; updatedAt: string }

const BLUE_URL = 'https://dolarapi.com/v1/dolares/blue'
const CACHE_MS = 10 * 60 * 1000

let cache: { rate: BlueRate; fetchedAt: number } | null = null

export function parseBlueRate(data: unknown): BlueRate {
  const { compra, venta, fechaActualizacion } = data as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown }
  if (typeof compra !== 'number' || typeof venta !== 'number') {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Respuesta inesperada de la cotización del blue' })
  }
  return { buy: compra, sell: venta, mid: (compra + venta) / 2, updatedAt: String(fechaActualizacion ?? '') }
}

// Dólar blue (same source dolarhoy.com shows). We use the midpoint between buy and sell.
export async function getBlueRate(): Promise<BlueRate> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.rate
  const response = await fetch(BLUE_URL, { signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!response?.ok) {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: 'No se pudo obtener la cotización del blue. Cargá el tipo de cambio a mano.' })
  }
  const rate = parseBlueRate(await response.json())
  cache = { rate, fetchedAt: Date.now() }
  return rate
}

// Automatic rate from `from` to `to` (1 `from` = rate `to`). Only ARS ↔ USD is automatic.
export async function getAutomaticRate(from: Currency, to: Currency): Promise<number> {
  if (from === 'USD' && to === 'ARS') return (await getBlueRate()).mid
  if (from === 'ARS' && to === 'USD') return 1 / (await getBlueRate()).mid
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
