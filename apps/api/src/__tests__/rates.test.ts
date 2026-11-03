import { afterEach, describe, expect, mock, test } from 'bun:test'
import { getQuote, parseQuote, resolveExchangeRate } from '../lib/rates'

describe('parseQuote', () => {
  test('uses the midpoint between buy and sell', () => {
    const rate = parseQuote({ compra: 1545, venta: 1565, fechaActualizacion: '2026-11-02T20:58:00.000Z' })
    expect(rate).toEqual({ buy: 1545, sell: 1565, mid: 1555, updatedAt: '2026-11-02T20:58:00.000Z' })
  })
  test('rejects unexpected payloads', () => {
    expect(() => parseQuote({ venta: 'x' })).toThrow()
  })
})

describe('getQuote', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })
  const stub = () => {
    const fetchMock = mock(async () => Response.json({ compra: 1515, venta: 1565, fechaActualizacion: '2026-11-02T18:00:00.000Z' }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    return () => String((fetchMock.mock.calls[0] as unknown[])[0])
  }
  test('USD: blue by default, oficial if asked', async () => {
    // Failed responses aren't cached, so this doesn't leak a fake blue into other test files
    const down = mock(async () => new Response('', { status: 503 }))
    globalThis.fetch = down as unknown as typeof fetch
    await expect(getQuote('USD')).rejects.toThrow()
    expect(String((down.mock.calls[0] as unknown[])[0])).toBe('https://dolarapi.com/v1/dolares/blue')
    const url = stub()
    expect((await getQuote('USD', 'oficial')).mid).toBe(1540)
    expect(url()).toBe('https://dolarapi.com/v1/dolares/oficial')
  })
  test('other currencies: the oficial quote', async () => {
    const url = stub()
    await getQuote('BRL')
    expect(url()).toBe('https://dolarapi.com/v1/cotizaciones/brl')
  })
  test('no blue for anything but the dollar', async () => {
    await expect(getQuote('EUR', 'blue')).rejects.toThrow('Solo el dólar')
  })
  test('asks for a manual rate when DolarApi is down', async () => {
    globalThis.fetch = mock(async () => new Response('', { status: 503 })) as unknown as typeof fetch
    await expect(getQuote('UYU')).rejects.toThrow('a mano')
  })
})

describe('resolveExchangeRate', () => {
  test('no rate when the currency is the base', async () => {
    expect(await resolveExchangeRate({ currency: 'ARS', baseCurrency: 'ARS', keepCurrency: false, exchangeRate: 99 })).toBeNull()
  })
  test('no rate when keeping the original currency', async () => {
    expect(await resolveExchangeRate({ currency: 'USD', baseCurrency: 'ARS', keepCurrency: true })).toBeNull()
  })
  test('manual rate wins over the automatic one', async () => {
    expect(await resolveExchangeRate({ currency: 'USD', baseCurrency: 'ARS', keepCurrency: false, exchangeRate: 1500 })).toBe(1500)
  })
  test('no automatic rate between two foreign currencies', async () => {
    await expect(resolveExchangeRate({ currency: 'EUR', baseCurrency: 'USD', keepCurrency: false })).rejects.toThrow('a mano')
  })
})
