import { afterEach, describe, expect, mock, test } from 'bun:test'
import { getDollarRate, parseDollarRate, resolveExchangeRate } from '../lib/rates'

describe('parseDollarRate', () => {
  test('uses the midpoint between buy and sell', () => {
    const rate = parseDollarRate({ compra: 1545, venta: 1565, fechaActualizacion: '2026-11-02T20:58:00.000Z' })
    expect(rate).toEqual({ buy: 1545, sell: 1565, mid: 1555, updatedAt: '2026-11-02T20:58:00.000Z' })
  })
  test('rejects unexpected payloads', () => {
    expect(() => parseDollarRate({ venta: 'x' })).toThrow()
  })
})

describe('getDollarRate', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })
  test('fetches the oficial from its own DolarApi endpoint', async () => {
    const fetchMock = mock(async () => Response.json({ compra: 1515, venta: 1565, fechaActualizacion: '2026-11-02T18:00:00.000Z' }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    expect((await getDollarRate('oficial')).mid).toBe(1540)
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('https://dolarapi.com/v1/dolares/oficial')
  })
  test('asks for a manual rate when DolarApi is down', async () => {
    globalThis.fetch = mock(async () => new Response('', { status: 503 })) as unknown as typeof fetch
    await expect(getDollarRate('blue')).rejects.toThrow('a mano')
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
  test('no automatic rate outside ARS ↔ USD', async () => {
    await expect(resolveExchangeRate({ currency: 'EUR', baseCurrency: 'ARS', keepCurrency: false })).rejects.toThrow('a mano')
  })
})
