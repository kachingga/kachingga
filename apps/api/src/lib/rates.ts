import { TRPCError } from '@trpc/server'
import type { Currency } from '../db/generated/prisma/enums'
import type { RateSource } from '../schemas'

export type Quote = { buy: number; sell: number; mid: number; updatedAt: string }
type QuotedCurrency = Exclude<Currency, 'ARS'>

const CACHE_MS = 10 * 60 * 1000
const cache = new Map<string, { quote: Quote; fetchedAt: number }>()

// Blue only exists for the dollar; everything else is the oficial (Banco Nación, via DolarApi).
export const defaultRateSource = (currency: QuotedCurrency): RateSource => (currency === 'USD' ? 'blue' : 'oficial')

export function parseQuote(data: unknown): Quote {
  const { compra, venta, fechaActualizacion } = data as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown }
  if (typeof compra !== 'number' || typeof venta !== 'number') {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Respuesta inesperada de la cotización' })
  }
  return { buy: compra, sell: venta, mid: (compra + venta) / 2, updatedAt: String(fechaActualizacion ?? '') }
}

// Price of 1 `currency` in ARS from DolarApi. We use the midpoint between buy and sell.
export async function getQuote(currency: QuotedCurrency, source: RateSource = defaultRateSource(currency)): Promise<Quote> {
  if (source === 'blue' && currency !== 'USD') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Solo el dólar tiene cotización blue' })
  }
  const url =
    currency === 'USD' ? `https://dolarapi.com/v1/dolares/${source}` : `https://dolarapi.com/v1/cotizaciones/${currency.toLowerCase()}`
  const cached = cache.get(url)
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.quote
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!response?.ok) {
    throw new TRPCError({ code: 'BAD_GATEWAY', message: 'No se pudo obtener la cotización. Cargá el tipo de cambio a mano.' })
  }
  const quote = parseQuote(await response.json())
  cache.set(url, { quote, fetchedAt: Date.now() })
  return quote
}

// Automatic rate from `from` to `to` (1 `from` = rate `to`), with each currency's default source
// (blue for USD, oficial for the rest). Only between ARS and another currency; any other pair goes by hand.
// Picking the oficial dollar (or any other rate) is up to the app, which sends it as `exchangeRate`.
export async function getAutomaticRate(from: Currency, to: Currency): Promise<number> {
  if (to === 'ARS' && from !== 'ARS') return (await getQuote(from)).mid
  if (from === 'ARS' && to !== 'ARS') return 1 / (await getQuote(to)).mid
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
