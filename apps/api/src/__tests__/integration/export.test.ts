import { describe, expect, test } from 'bun:test'
import { setupTestApi } from './setup'

const { caller, anonymous } = await setupTestApi()

describe('expenses.export', () => {
  test('exports every filtered expense (no pagination) as CSV and JSON, oldest first', async () => {
    const yo = caller('yo-export')
    const g = await yo.groups.create({ name: 'Viaje', baseCurrency: 'ARS', myName: 'Yo' })
    const tuke = await yo.participants.add({ groupId: g.id, name: 'Tuke' })
    const me = (await yo.groups.get({ groupId: g.id })).myParticipantId
    for (let i = 0; i < 60; i++) {
      await yo.expenses.create({
        groupId: g.id,
        description: i === 0 ? 'Primero' : `Gasto ${i}`,
        category: i % 2 ? 'FOOD' : 'OTHER',
        date: new Date(Date.UTC(2026, 10, 1 + (i % 28), 12)),
        amountCents: 1000,
        currency: 'ARS',
        paidById: tuke.id,
        split: { type: 'EQUAL', participantIds: [me, tuke.id] },
      })
    }

    const csv = await yo.expenses.export({ groupId: g.id, format: 'csv' })
    expect(csv.filename).toMatch(/^kachingga-viaje-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(csv.content.trim().split('\r\n')).toHaveLength(61) // header + 60, more than one page of the list

    const json = await yo.expenses.export({ groupId: g.id, format: 'json', filters: { categories: ['FOOD'] } })
    const data = JSON.parse(json.content)
    expect(data).toMatchObject({ grupo: 'Viaje', moneda_base: 'ARS', filtros: { categories: ['FOOD'] } })
    expect(data.gastos).toHaveLength(30)
    expect(data.gastos.every((r: { categoria: string; mi_parte: number }) => r.categoria === 'Comida' && r.mi_parte === 5)).toBe(true)
    expect(data.gastos[0].fecha <= data.gastos.at(-1).fecha).toBe(true)
  })

  test('only members can export; requires login', async () => {
    const yo = caller('yo-export-2')
    const g = await yo.groups.create({ name: 'Privado', baseCurrency: 'ARS', myName: 'Yo' })
    await expect(caller('intruso-export').expenses.export({ groupId: g.id, format: 'csv' })).rejects.toThrow('Grupo no encontrado')
    await expect(anonymous.expenses.export({ groupId: g.id, format: 'csv' })).rejects.toThrow('UNAUTHORIZED')
  })
})
