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
    // Each built-in category has its own color (no two alike) from the category palette.
    expect(new Set(list.map((c) => c.color)).size).toBe(8)
    expect(list.map((c) => c.color)).toEqual(defaultCategories.map((c) => c.color))
  })

  test('only colors from the category palette (old theme names are rejected)', async () => {
    const { ana, group } = await newGroup()
    await expect(ana.categories.create({ groupId: group.id, name: 'Vieja', icon: 'gift', color: 'chart-1' as 'mint' })).rejects.toThrow()
    const ok = await ana.categories.create({ groupId: group.id, name: 'Nueva', icon: 'gift', color: 'raspberry' })
    expect(ok.color).toBe('raspberry')
  })

  test('an expense without category goes to the group\'s "Otros"', async () => {
    const { expense } = await newGroup()
    expect((await expense()).category).toMatchObject({ name: 'Otros' })
  })

  test('any member can create, rename, recolor and use a category', async () => {
    const { ana, beto, group, expense } = await newGroup()
    const nafta = await beto.categories.create({ groupId: group.id, name: 'Nafta', icon: 'fuel', color: 'teal' })
    const renamed = await ana.categories.update({ categoryId: nafta.id, name: 'Combustible', color: 'pink' })
    expect(renamed).toMatchObject({ name: 'Combustible', icon: 'fuel', color: 'pink', defaultKey: null })
    await expense(nafta.id)
    const list = await ana.categories.list({ groupId: group.id })
    expect(list.at(-1)).toMatchObject({ id: nafta.id, name: 'Combustible', expenseCount: 1 })
  })

  test('names are unique among active categories (ignoring case)', async () => {
    const { ana, group } = await newGroup()
    await expect(ana.categories.create({ groupId: group.id, name: 'comida', icon: 'pizza', color: 'mint' })).rejects.toThrow(
      'Ya hay una categoría',
    )
    const list = await ana.categories.list({ groupId: group.id })
    const food = list.find((c) => c.defaultKey === 'FOOD')!
    const groceries = list.find((c) => c.defaultKey === 'GROCERIES')!
    await expect(ana.categories.update({ categoryId: groceries.id, name: 'COMIDA' })).rejects.toThrow('Ya hay una categoría')
    // Archived names are free again; un-archiving then conflicts.
    await ana.categories.archive({ categoryId: food.id })
    await ana.categories.create({ groupId: group.id, name: 'Comida', icon: 'pizza', color: 'mint' })
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
    await expect(ana.categories.create({ groupId: group.id, name: 'X', icon: 'gift', color: 'mint' })).rejects.toThrow('archivado')
    await expect(ana.categories.update({ categoryId: food.id, name: 'X' })).rejects.toThrow('archivado')
    await expect(ana.categories.archive({ categoryId: food.id })).rejects.toThrow('archivado')
  })

  test('only known icons and colors', async () => {
    const { ana, group } = await newGroup()
    await expect(ana.categories.create({ groupId: group.id, name: 'X', icon: 'skull' as 'gift', color: 'mint' })).rejects.toThrow()
    await expect(ana.categories.create({ groupId: group.id, name: 'X', icon: 'gift', color: '#ff0000' as 'mint' })).rejects.toThrow()
  })

  test('filters, totals and saved filters use the category ids', async () => {
    const { ana, group, expense } = await newGroup()
    const nafta = await ana.categories.create({ groupId: group.id, name: 'Nafta', icon: 'fuel', color: 'teal' })
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

describe('categories.suggest', () => {
  const suggest = (who: Awaited<ReturnType<typeof newGroup>>['ana'], groupId: string, description: string) =>
    who.categories.suggest({ groupId, description })
  async function named(ana: Awaited<ReturnType<typeof newGroup>>['ana'], groupId: string, key: string) {
    return (await ana.categories.list({ groupId })).find((c) => c.defaultKey === key)!
  }
  async function expenseWith(ctx: Awaited<ReturnType<typeof newGroup>>, description: string, categoryId?: string) {
    const created = await ctx.expense(categoryId)
    const { ana } = ctx
    return ana.expenses.update({
      expenseId: created.id,
      description,
      date: created.date,
      amountCents: created.amountCents,
      currency: 'ARS',
      paidById: created.paidById,
      split: { type: 'EQUAL', participantIds: [created.paidById] },
      ...(categoryId && { categoryId }),
    })
  }

  test('requires login; non-members get "not found"', async () => {
    const { group } = await newGroup()
    await expect(anonymous.categories.suggest({ groupId: group.id, description: 'Coto' })).rejects.toThrow('UNAUTHORIZED')
    await expect(suggest(caller('intruso-suggest'), group.id, 'Coto')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  test('keywords → the built-in category of the group (even renamed)', async () => {
    const { ana, beto, group } = await newGroup()
    const groceries = await named(ana, group.id, 'GROCERIES')
    const transport = await named(ana, group.id, 'TRANSPORT')
    expect(await suggest(beto, group.id, 'Coto')).toEqual({ categoryId: groceries.id, source: 'keyword' })
    expect(await suggest(ana, group.id, 'Uber a casa')).toEqual({ categoryId: transport.id, source: 'keyword' })
    await ana.categories.update({ categoryId: groceries.id, name: 'Supermercado' })
    expect(await suggest(ana, group.id, 'Carrefour')).toMatchObject({ categoryId: groceries.id })
  })

  test('nothing matches → null', async () => {
    const { ana, group } = await newGroup()
    expect(await suggest(ana, group.id, 'Varios')).toBeNull()
  })

  test("the group's history comes first, with its custom categories", async () => {
    const ctx = await newGroup()
    const { ana, group } = ctx
    const nafta = await ana.categories.create({ groupId: group.id, name: 'Nafta', icon: 'fuel', color: 'teal' })
    await expenseWith(ctx, 'YPF ruta 2', nafta.id)
    // "YPF" is a transport keyword, but the group already used "Nafta" for it.
    expect(await suggest(ana, group.id, 'ypf Ruta 2')).toEqual({ categoryId: nafta.id, source: 'history' })
    expect(await suggest(ana, group.id, 'YPF ruta 11')).toEqual({ categoryId: nafta.id, source: 'history' })
    const transport = await named(ana, group.id, 'TRANSPORT')
    expect(await suggest(ana, group.id, 'Shell')).toEqual({ categoryId: transport.id, source: 'keyword' })
  })

  test('deleted expenses and archived categories are never suggested', async () => {
    const ctx = await newGroup()
    const { ana, group } = ctx
    const nafta = await ana.categories.create({ groupId: group.id, name: 'Nafta', icon: 'fuel', color: 'teal' })
    await expenseWith(ctx, 'YPF', nafta.id)
    const deleted = await expenseWith(ctx, 'Cosas raras', nafta.id)
    await ana.expenses.delete({ expenseId: deleted.id })
    expect(await suggest(ana, group.id, 'Cosas raras')).toBeNull()

    await ana.categories.archive({ categoryId: nafta.id })
    const transport = await named(ana, group.id, 'TRANSPORT')
    expect(await suggest(ana, group.id, 'YPF')).toEqual({ categoryId: transport.id, source: 'keyword' })
    await ana.categories.archive({ categoryId: transport.id })
    expect(await suggest(ana, group.id, 'YPF')).toBeNull()
  })

  test("another group's history and categories are never suggested", async () => {
    const mine = await newGroup()
    const other = await newGroup()
    const nafta = await other.ana.categories.create({ groupId: other.group.id, name: 'Nafta', icon: 'fuel', color: 'teal' })
    await expenseWith(other, 'Cosas raras', nafta.id)
    expect(await suggest(mine.ana, mine.group.id, 'Cosas raras')).toBeNull()
    const result = await suggest(mine.ana, mine.group.id, 'Coto')
    expect(result!.categoryId).toBe((await named(mine.ana, mine.group.id, 'GROCERIES')).id)
  })

  test('works on archived groups too (read-only) and validates the description', async () => {
    const { ana, group } = await newGroup()
    await ana.groups.setArchived({ groupId: group.id, archived: true })
    expect(await suggest(ana, group.id, 'Coto')).toMatchObject({ source: 'keyword' })
    await expect(suggest(ana, group.id, '   ')).rejects.toThrow()
    await expect(suggest(ana, group.id, 'x'.repeat(121))).rejects.toThrow()
  })
})
