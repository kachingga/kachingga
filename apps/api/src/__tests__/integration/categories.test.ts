import { describe, expect, test } from 'bun:test'
import { defaultCategories } from '../../schemas'
import { setupTestApi } from './setup'

const { caller, anonymous } = await setupTestApi()

let n = 0
async function newGroup() {
  n += 1
  const ana = caller(`ana-cat-${n}`)
  const beto = caller(`beto-cat-${n}`)
  const group = await ana.groups.create({ name: 'Casa', baseCurrency: 'ARS', myName: 'Ana' })
  await beto.groups.join({ inviteCode: group.inviteCode, name: 'Beto' })
  const me = (await ana.groups.get({ groupId: group.id })).myParticipantId
  const expense = (categoryId?: string) =>
    ana.expenses.create({
      groupId: group.id,
      description: 'Algo',
      date: new Date('2026-11-01T12:00:00Z'),
      amountCents: 1000,
      currency: 'ARS',
      paidById: me,
      split: { type: 'EQUAL', participantIds: [me] },
      ...(categoryId && { categoryId }),
    })
  return { ana, beto, group, expense }
}

describe('categories', () => {
  test('requires login', async () => {
    await expect(anonymous.categories.list({ groupId: 'x' })).rejects.toThrow('UNAUTHORIZED')
  })

  test('a new group starts with the 8 built-in categories, in order', async () => {
    const { ana, group } = await newGroup()
    const list = await ana.categories.list({ groupId: group.id })
    expect(list.map((c) => c.defaultKey)).toEqual(defaultCategories.map((c) => c.key))
    expect(list.map((c) => c.name)).toEqual(['Comida', 'Súper', 'Transporte', 'Alojamiento', 'Salidas', 'Compras', 'Servicios', 'Otros'])
    expect(list.every((c) => !c.archived && c.expenseCount === 0)).toBe(true)
  })

  test('an expense without category goes to the group\'s "Otros"', async () => {
    const { expense } = await newGroup()
    expect((await expense()).category).toMatchObject({ name: 'Otros' })
  })

  test('any member can create, rename, recolor and use a category', async () => {
    const { ana, beto, group, expense } = await newGroup()
    const nafta = await beto.categories.create({ groupId: group.id, name: 'Nafta', icon: 'fuel', color: 'chart-4' })
    const renamed = await ana.categories.update({ categoryId: nafta.id, name: 'Combustible', color: 'highlight' })
    expect(renamed).toMatchObject({ name: 'Combustible', icon: 'fuel', color: 'highlight', defaultKey: null })
    await expense(nafta.id)
    const list = await ana.categories.list({ groupId: group.id })
    expect(list.at(-1)).toMatchObject({ id: nafta.id, name: 'Combustible', expenseCount: 1 })
  })

  test('names are unique among active categories (ignoring case)', async () => {
    const { ana, group } = await newGroup()
    await expect(ana.categories.create({ groupId: group.id, name: 'comida', icon: 'pizza', color: 'chart-1' })).rejects.toThrow(
      'Ya hay una categoría',
    )
    const list = await ana.categories.list({ groupId: group.id })
    const food = list.find((c) => c.defaultKey === 'FOOD')!
    const groceries = list.find((c) => c.defaultKey === 'GROCERIES')!
    await expect(ana.categories.update({ categoryId: groceries.id, name: 'COMIDA' })).rejects.toThrow('Ya hay una categoría')
    // Archived names are free again; un-archiving then conflicts.
    await ana.categories.archive({ categoryId: food.id })
    await ana.categories.create({ groupId: group.id, name: 'Comida', icon: 'pizza', color: 'chart-1' })
    await expect(ana.categories.unarchive({ categoryId: food.id })).rejects.toThrow('Ya hay una categoría')
  })

  test('archived: kept on its expenses, not usable for new ones (except the one it already had)', async () => {
    const { ana, group, expense } = await newGroup()
    const food = (await ana.categories.list({ groupId: group.id })).find((c) => c.defaultKey === 'FOOD')!
    const old = await expense(food.id)
    await ana.categories.archive({ categoryId: food.id })

    expect((await ana.categories.list({ groupId: group.id })).find((c) => c.id === food.id)).toMatchObject({
      archived: true,
      expenseCount: 1,
    })
    expect((await ana.expenses.get({ expenseId: old.id })).category).toMatchObject({ name: 'Comida' })
    await expect(expense(food.id)).rejects.toThrow('archivada')
    // Editing the old expense keeps its archived category.
    const edited = await ana.expenses.update({
      expenseId: old.id,
      description: 'Editado',
      categoryId: food.id,
      date: old.date,
      amountCents: old.amountCents,
      currency: 'ARS',
      paidById: old.paidById,
      split: { type: 'EQUAL', participantIds: [old.paidById] },
    })
    expect(edited).toMatchObject({ description: 'Editado', categoryId: food.id })

    await ana.categories.unarchive({ categoryId: food.id })
    await expense(food.id)
  })

  test("the group can't run out of active categories", async () => {
    const { ana, group } = await newGroup()
    const list = await ana.categories.list({ groupId: group.id })
    for (const c of list.slice(1)) await ana.categories.archive({ categoryId: c.id })
    await expect(ana.categories.archive({ categoryId: list[0]!.id })).rejects.toThrow('al menos una')
  })

  test('archived group: read-only', async () => {
    const { ana, group } = await newGroup()
    const food = (await ana.categories.list({ groupId: group.id })).find((c) => c.defaultKey === 'FOOD')!
    await ana.groups.setArchived({ groupId: group.id, archived: true })
    expect(await ana.categories.list({ groupId: group.id })).toHaveLength(8)
    await expect(ana.categories.create({ groupId: group.id, name: 'X', icon: 'gift', color: 'chart-1' })).rejects.toThrow('archivado')
    await expect(ana.categories.update({ categoryId: food.id, name: 'X' })).rejects.toThrow('archivado')
    await expect(ana.categories.archive({ categoryId: food.id })).rejects.toThrow('archivado')
  })

  test('only known icons and colors', async () => {
    const { ana, group } = await newGroup()
    await expect(ana.categories.create({ groupId: group.id, name: 'X', icon: 'skull' as 'gift', color: 'chart-1' })).rejects.toThrow()
    await expect(ana.categories.create({ groupId: group.id, name: 'X', icon: 'gift', color: '#ff0000' as 'chart-1' })).rejects.toThrow()
  })

  test('filters, totals and saved filters use the category ids', async () => {
    const { ana, group, expense } = await newGroup()
    const nafta = await ana.categories.create({ groupId: group.id, name: 'Nafta', icon: 'fuel', color: 'chart-4' })
    await expense(nafta.id)
    await expense()
    const list = await ana.expenses.list({ groupId: group.id, filters: { categoryIds: [nafta.id] } })
    expect(list.items).toHaveLength(1)
    const [summary] = await ana.expenses.summary({ groupId: group.id })
    expect(summary!.byCategory).toEqual([
      { categoryId: nafta.id, name: 'Nafta', totalCents: 1000 },
      expect.objectContaining({ name: 'Otros', totalCents: 1000 }),
    ])
    await ana.savedFilters.create({ groupId: group.id, name: 'Nafta', filters: { categoryIds: [nafta.id] } })
    expect((await ana.savedFilters.list({ groupId: group.id }))[0]!.filters).toEqual({ categoryIds: [nafta.id] })
  })
})
