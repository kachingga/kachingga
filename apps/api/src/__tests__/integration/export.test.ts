import { describe, expect, test } from 'bun:test'
import { toCsv, toExportRows } from '../../lib/exportExpenses'
import { setupTestApi } from './setup'

const { caller, anonymous, categoryId, prisma } = await setupTestApi()

describe('expenses.export', () => {
  test('exports every filtered expense (no pagination) as CSV and JSON, oldest first', async () => {
    const yo = caller('yo-export')
    const g = await yo.groups.create({ name: 'Viaje', baseCurrency: 'ARS', myName: 'Yo' })
    const tuke = await yo.participants.add({ groupId: g.id, name: 'Tuke' })
    const me = (await yo.groups.get({ groupId: g.id })).myParticipantId
    const food = await categoryId('yo-export', g.id, 'FOOD')
    for (let i = 0; i < 60; i++) {
      await yo.expenses.create({
        groupId: g.id,
        description: i === 0 ? 'Primero' : `Gasto ${i}`,
        ...(i % 2 && { categoryId: food }), // the rest: the group's "Otros" by default
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

    const json = await yo.expenses.export({ groupId: g.id, format: 'json', filters: { categoryIds: [food] } })
    const data = JSON.parse(json.content)
    expect(data).toMatchObject({ grupo: 'Viaje', moneda_base: 'ARS', filtros: { categoryIds: [food] } })
    expect(data.gastos).toHaveLength(30)
    expect(data.gastos.every((r: { categoria: string; mi_parte: number }) => r.categoria === 'Comida' && r.mi_parte === 5)).toBe(true)
    expect(data.gastos[0].fecha <= data.gastos.at(-1).fecha).toBe(true)
  })

  test('built in batches: the same file as building it all at once, nothing missing or repeated', async () => {
    const yo = caller('yo-export-batches')
    const g = await yo.groups.create({ name: 'Lleno', baseCurrency: 'ARS', myName: 'Yo' })
    const tuke = await yo.participants.add({ groupId: g.id, name: 'Tuke' })
    const me = (await yo.groups.get({ groupId: g.id })).myParticipantId
    const other = await categoryId('yo-export-batches', g.id, 'OTHER')
    // More than two batches of 500. Few dates and one createdAt for all (one INSERT): the order across
    // batches depends on the id too, as in the API's orderBy.
    const N = 1203
    const ids = Array.from({ length: N }, (_, i) => `exp-${String((i * 7919) % N).padStart(5, '0')}`)
    await prisma.expense.createMany({
      data: ids.map((id, i) => ({
        id,
        groupId: g.id,
        description: `Gasto ${i}`,
        categoryId: other,
        date: new Date(Date.UTC(2026, 10, 1 + (i % 3), 12)),
        amountCents: 1000 + i,
        currency: 'ARS' as const,
        splitType: 'EQUAL' as const,
        paidById: i % 2 ? me : tuke.id,
        createdById: 'yo-export-batches',
      })),
    })
    await prisma.expenseSplit.createMany({
      data: ids.flatMap((expenseId, i) => [
        { expenseId, participantId: me, amountCents: 500 },
        { expenseId, participantId: tuke.id, amountCents: 500 + i },
      ]),
    })
    // How it was built before: every expense at once
    const all = await prisma.expense.findMany({
      where: { groupId: g.id, deletedAt: null },
      include: { category: true, paidBy: true, splits: { include: { participant: true } } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    const rows = toExportRows('ARS', me, all)

    const csv = await yo.expenses.export({ groupId: g.id, format: 'csv' })
    expect(csv.content).toBe(toCsv(rows))
    const json = JSON.parse((await yo.expenses.export({ groupId: g.id, format: 'json' })).content)
    expect(json.gastos).toEqual(JSON.parse(JSON.stringify(rows)))
    expect(json.gastos).toHaveLength(N)
  })

  test('only members can export; requires login', async () => {
    const yo = caller('yo-export-2')
    const g = await yo.groups.create({ name: 'Privado', baseCurrency: 'ARS', myName: 'Yo' })
    await expect(caller('intruso-export').expenses.export({ groupId: g.id, format: 'csv' })).rejects.toThrow('Grupo no encontrado')
    await expect(anonymous.expenses.export({ groupId: g.id, format: 'csv' })).rejects.toThrow('UNAUTHORIZED')
  })
})
