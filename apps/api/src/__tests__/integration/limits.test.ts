// Limits against abuse (#107): quotas, caps on inputs, races and the per-user write limit.
// The per-IP limits and the request size are HTTP concerns: http.test.ts.
import { describe, expect, test } from 'bun:test'
import { TRPCError } from '@trpc/server'
import {
  MAX_CATEGORIES_PER_GROUP,
  MAX_GROUPS_CREATED_PER_USER,
  MAX_PARTICIPANTS_PER_GROUP,
  MAX_SAVED_FILTERS_PER_GROUP,
} from '../../lib/quotas'
import { USER_WRITE_RULES } from '../../lib/rateLimit'
import { setupTestApi } from './setup'

const { caller, prisma } = await setupTestApi()

let n = 0
async function newGroup() {
  n += 1
  const ana = caller(`ana-lim-${n}`)
  const group = await ana.groups.create({ name: 'Viaje', baseCurrency: 'ARS', myName: 'Ana' })
  const me = (await ana.groups.get({ groupId: group.id })).myParticipantId
  return { ana, group, me, n }
}

const day = new Date('2026-11-01T12:00:00Z')

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (e: unknown) => (e instanceof TRPCError ? e.code : String(e)),
  )

describe('quotas', () => {
  test(`a group has at most ${MAX_PARTICIPANTS_PER_GROUP} people (add or join as new); claiming still works`, async () => {
    const { ana, group } = await newGroup()
    await prisma.participant.createMany({
      data: Array.from({ length: MAX_PARTICIPANTS_PER_GROUP - 2 }, (_, i) => ({ groupId: group.id, name: `P${i}` })),
    })
    const last = await ana.participants.add({ groupId: group.id, name: 'Último' })
    const message = `Un grupo puede tener hasta ${MAX_PARTICIPANTS_PER_GROUP} personas.`
    await expect(ana.participants.add({ groupId: group.id, name: 'Uno más' })).rejects.toThrow(message)
    await expect(caller(`new-lim-${n}`).groups.join({ inviteCode: group.inviteCode, name: 'Nuevo' })).rejects.toThrow(message)
    // Claiming someone who's already there doesn't add anyone
    await caller(`claim-lim-${n}`).groups.join({ inviteCode: group.inviteCode, participantId: last.id })
    expect(await prisma.participant.count({ where: { groupId: group.id } })).toBe(MAX_PARTICIPANTS_PER_GROUP)
  })

  test(`each user creates at most ${MAX_GROUPS_CREATED_PER_USER} groups (archived ones count)`, async () => {
    const user = `creator-lim-${++n}`
    await prisma.group.createMany({
      data: Array.from({ length: MAX_GROUPS_CREATED_PER_USER - 1 }, (_, i) => ({
        name: `G${i}`,
        baseCurrency: 'ARS' as const,
        inviteCode: `Q${n}X${i}`.padEnd(8, 'Z'),
        createdById: user,
        archivedAt: i === 0 ? new Date() : null,
      })),
    })
    await caller(user).groups.create({ name: 'Última', baseCurrency: 'ARS', myName: 'Yo' })
    await expect(caller(user).groups.create({ name: 'Una más', baseCurrency: 'ARS', myName: 'Yo' })).rejects.toThrow(
      `Podés crear hasta ${MAX_GROUPS_CREATED_PER_USER} grupos.`,
    )
    // Joining other groups is not limited by this
    const other = await newGroup()
    await caller(user).groups.join({ inviteCode: other.group.inviteCode, name: 'Yo' })
  })

  test(`a group has at most ${MAX_CATEGORIES_PER_GROUP} categories, archived ones included`, async () => {
    const { ana, group } = await newGroup()
    // 8 built-in + the rest, one of them archived
    await prisma.category.createMany({
      data: Array.from({ length: MAX_CATEGORIES_PER_GROUP - 9 }, (_, i) => ({
        groupId: group.id,
        name: `C${i}`,
        icon: 'gift',
        color: 'mint',
        archivedAt: i === 0 ? new Date() : null,
      })),
    })
    await ana.categories.create({ groupId: group.id, name: 'Última', icon: 'gift', color: 'mint' })
    await expect(ana.categories.create({ groupId: group.id, name: 'Una más', icon: 'gift', color: 'mint' })).rejects.toThrow(
      `Un grupo puede tener hasta ${MAX_CATEGORIES_PER_GROUP} categorías, contando las archivadas.`,
    )
  })

  test(`each user saves at most ${MAX_SAVED_FILTERS_PER_GROUP} filters per group`, async () => {
    const { ana, group } = await newGroup()
    const beto = caller(`beto-lim-${n}`)
    await beto.groups.join({ inviteCode: group.inviteCode, name: 'Beto' })
    for (let i = 0; i < MAX_SAVED_FILTERS_PER_GROUP; i++) await ana.savedFilters.create({ groupId: group.id, name: `F${i}`, filters: {} })
    await expect(ana.savedFilters.create({ groupId: group.id, name: 'Uno más', filters: {} })).rejects.toThrow(
      `Podés guardar hasta ${MAX_SAVED_FILTERS_PER_GROUP} filtros por grupo.`,
    )
    // Personal: someone else in the same group still can
    await beto.savedFilters.create({ groupId: group.id, name: 'Míos', filters: {} })
  })
})

describe('caps on inputs', () => {
  test('ids over 40 characters are rejected', async () => {
    const { ana } = await newGroup()
    expect(await codeOf(ana.groups.get({ groupId: 'x'.repeat(41) }))).toBe('BAD_REQUEST')
    expect(await codeOf(ana.expenses.get({ expenseId: 'x'.repeat(41) }))).toBe('BAD_REQUEST')
  })

  test('at most 100 people in a split and 100 categories in a filter', async () => {
    const { ana, group, me } = await newGroup()
    const many = Array.from({ length: 101 }, () => me)
    const expense = { groupId: group.id, description: 'x', date: day, amountCents: 10100, currency: 'ARS' as const, paidById: me }
    expect(await codeOf(ana.expenses.create({ ...expense, split: { type: 'EQUAL', participantIds: many } }))).toBe('BAD_REQUEST')
    expect(
      await codeOf(
        ana.expenses.create({
          ...expense,
          split: { type: 'AMOUNT', shares: many.map((participantId) => ({ participantId, amountCents: 100 })) },
        }),
      ),
    ).toBe('BAD_REQUEST')
    expect(await codeOf(ana.expenses.list({ groupId: group.id, filters: { categoryIds: many } }))).toBe('BAD_REQUEST')
    expect(await codeOf(ana.savedFilters.create({ groupId: group.id, name: 'X', filters: { categoryIds: many } }))).toBe('BAD_REQUEST')
    expect(await prisma.expense.count({ where: { groupId: group.id } })).toBe(0)
  })

  test('dates between 2000 and 2100, with a clear message', async () => {
    const { ana, group, me } = await newGroup()
    const expense = (date: Date) =>
      ana.expenses.create({
        groupId: group.id,
        description: 'x',
        date,
        amountCents: 100,
        currency: 'ARS',
        paidById: me,
        split: { type: 'EQUAL', participantIds: [me] },
      })
    const message = 'La fecha tiene que estar entre el año 2000 y el 2100'
    await expect(expense(new Date('0202-11-01T12:00:00Z'))).rejects.toThrow(message)
    await expect(expense(new Date('2101-01-01T12:00:00Z'))).rejects.toThrow(message)
    await expense(new Date('2000-01-01T12:00:00Z'))
    await expect(
      ana.settlements.create({
        groupId: group.id,
        fromId: me,
        toId: me,
        amountCents: 1,
        currency: 'ARS',
        date: new Date('1999-12-31T12:00:00Z'),
      }),
    ).rejects.toThrow(message)
    await expect(ana.expenses.summary({ groupId: group.id, filters: { dateFrom: new Date('1900-01-01T00:00:00Z') } })).rejects.toThrow(
      message,
    )
  })

  test('invite codes must have their length', async () => {
    const { group } = await newGroup()
    const eve = caller(`eve-lim-${n}`)
    await expect(eve.groups.preview({ inviteCode: group.inviteCode.slice(1) })).rejects.toThrow('Código inválido')
    await expect(eve.groups.preview({ inviteCode: group.inviteCode + 'X'.repeat(1000) })).rejects.toThrow('Código inválido')
    expect((await eve.groups.preview({ inviteCode: ` ${group.inviteCode.toLowerCase()} ` })).id).toBe(group.id)
  })

  test('saved filters store what the schema parsed, never the raw input', async () => {
    const { ana, group } = await newGroup()
    const saved = await ana.savedFilters.create({
      groupId: group.id,
      name: 'Raro',
      filters: { search: '  pizza  ', junk: 'x'.repeat(10_000) } as { search: string },
    })
    const row = await prisma.savedFilter.findUniqueOrThrow({ where: { id: saved.id } })
    expect(row.filters).toEqual({ search: 'pizza' })
  })
})

describe('races', () => {
  test('two categories with the same name at the same time: only one is created', async () => {
    const { ana, group } = await newGroup()
    const results = await Promise.all([
      codeOf(ana.categories.create({ groupId: group.id, name: 'Nafta', icon: 'fuel', color: 'teal' })),
      codeOf(ana.categories.create({ groupId: group.id, name: 'NAFTA', icon: 'fuel', color: 'teal' })),
    ])
    expect(results.sort()).toEqual(['CONFLICT', 'ok'])
    const names = (await ana.categories.list({ groupId: group.id })).map((c) => c.name.toLowerCase())
    expect(names.filter((name) => name === 'nafta')).toHaveLength(1)
  })

  test('the database rejects two active categories with the same name (archived ones can repeat it)', async () => {
    const { group } = await newGroup()
    const data = { groupId: group.id, icon: 'gift', color: 'mint' }
    await prisma.category.create({ data: { ...data, name: 'Regalos', archivedAt: new Date() } })
    await prisma.category.create({ data: { ...data, name: 'regalos', archivedAt: new Date() } })
    await prisma.category.create({ data: { ...data, name: 'Regalos' } })
    const duplicate = await prisma.category.create({ data: { ...data, name: 'REGALOS' } }).then(
      () => null,
      (e: { code?: string }) => e.code,
    )
    expect(duplicate).toBe('P2002')
    // Other groups are independent
    const other = await newGroup()
    await prisma.category.create({ data: { ...data, groupId: other.group.id, name: 'Regalos' } })
  })

  test('renaming two categories to the same name at the same time: CONFLICT, not duplicates', async () => {
    const { ana, group } = await newGroup()
    const [food, groceries] = await ana.categories.list({ groupId: group.id })
    const results = await Promise.all([
      codeOf(ana.categories.update({ categoryId: food!.id, name: 'Morfi' })),
      codeOf(ana.categories.update({ categoryId: groceries!.id, name: 'morfi' })),
    ])
    expect(results.sort()).toEqual(['CONFLICT', 'ok'])
  })

  test('archiving the last two active categories at the same time leaves one', async () => {
    const { ana, group } = await newGroup()
    const list = await ana.categories.list({ groupId: group.id })
    for (const c of list.slice(2)) await ana.categories.archive({ categoryId: c.id })
    const results = await Promise.all(list.slice(0, 2).map((c) => codeOf(ana.categories.archive({ categoryId: c.id }))))
    expect(results.sort()).toEqual(['BAD_REQUEST', 'ok'])
    expect((await ana.categories.list({ groupId: group.id })).filter((c) => !c.archived)).toHaveLength(1)
  })

  test("removing someone while they're being claimed never deletes a person with account", async () => {
    const { ana, group } = await newGroup()
    const juan = await ana.participants.add({ groupId: group.id, name: 'Juan' })
    const [joined, removed] = await Promise.all([
      codeOf(caller(`juan-lim-${n}`).groups.join({ inviteCode: group.inviteCode, participantId: juan.id })),
      codeOf(ana.participants.remove({ participantId: juan.id })),
    ])
    const stillThere = await prisma.participant.findUnique({ where: { id: juan.id } })
    // Either Juan joined (and is still in the group, with his account) or he was removed before
    if (joined === 'ok') expect(stillThere?.userId).toBe(`juan-lim-${n}`)
    else expect(removed).toBe('ok')
    expect([joined, removed]).toContain('ok')
  })
})

describe('per-user write limit', () => {
  test('too many writes in a row from one user → TOO_MANY_REQUESTS; reads and other users are not affected', async () => {
    const { group } = await newGroup()
    const ip = '203.0.113.50'
    const flooder = caller(`flood-lim-${n}`, ip)
    const [perMinute] = USER_WRITE_RULES
    for (let i = 0; i < perMinute!.limit; i++) await flooder.profile.update({ paymentAlias: null })
    await expect(flooder.profile.update({ paymentAlias: null })).rejects.toThrow('Demasiados pedidos')
    expect(await flooder.profile.get()).toEqual({ paymentAlias: null })
    await caller(`other-lim-${n}`, ip).groups.join({ inviteCode: group.inviteCode, name: 'Otra' })
  })
})
