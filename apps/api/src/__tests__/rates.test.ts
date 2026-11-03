import { describe, expect, test } from 'bun:test'
import { parseBlueRate, resolveExchangeRate } from '../lib/rates'

describe('parseBlueRate', () => {
  test('uses the midpoint between buy and sell', () => {
    const rate = parseBlueRate({ compra: 1545, venta: 1565, fechaActualizacion: '2026-11-02T20:58:00.000Z' })
    expect(rate).toEqual({ buy: 1545, sell: 1565, mid: 1555, updatedAt: '2026-11-02T20:58:00.000Z' })
  })
  test('rejects unexpected payloads', () => {
    expect(() => parseBlueRate({ venta: 'x' })).toThrow()
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
