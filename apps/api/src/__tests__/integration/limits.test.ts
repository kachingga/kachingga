// Limits against abuse (#107): quotas, caps on inputs, races, the per-user limits and the database
// size guard. The per-IP limits and the request size are HTTP concerns: http.test.ts.
import { describe, expect, setSystemTime, test } from 'bun:test'
import { TRPCError } from '@trpc/server'
import { DB_FULL_MESSAGE } from '../../lib/dbSize'
import {
  MAX_CATEGORIES_PER_GROUP,
  MAX_EXPENSES_PER_GROUP,
  MAX_GROUPS_CREATED_PER_USER,
  MAX_PARTICIPANTS_PER_GROUP,
  MAX_SAVED_FILTERS_PER_GROUP,
  MAX_SETTLEMENTS_PER_GROUP,
} from '../../lib/quotas'
import {
  CREATING_PROCEDURES,
  CREATION_LIMIT_MESSAGE,
  RATE_LIMIT_MESSAGE,
  USER_CREATION_RULE,
  USER_PROCEDURE_RULES,
  USER_WRITE_RULES,
} from '../../lib/rateLimit'
import { setupTestApi } from './setup'

const { caller, prisma, categoryId } = await setupTestApi()

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

  test('a group already over the people cap keeps working; it just takes nobody else', async () => {
    const { ana, group, me } = await newGroup()
    await prisma.participant.createMany({
      data: Array.from({ length: MAX_PARTICIPANTS_PER_GROUP + 4 }, (_, i) => ({ groupId: group.id, name: `P${i}` })),
    })
    const everyone = (await ana.groups.get({ groupId: group.id })).participants.map((p) => p.id)
    expect(everyone.length).toBeGreaterThan(MAX_PARTICIPANTS_PER_GROUP)
    const expense = await ana.expenses.create({
      groupId: group.id,
      description: 'Asado',
      date: day,
      amountCents: 100 * everyone.length,
      currency: 'ARS',
      paidById: me,
      split: { type: 'EQUAL', participantIds: everyone },
    })
    expect(expense.splits).toHaveLength(everyone.length)
    await ana.participants.rename({ participantId: everyone.at(-1)!, name: 'Renombrado' })
    await expect(ana.participants.add({ groupId: group.id, name: 'Uno más' })).rejects.toThrow(
      `Un grupo puede tener hasta ${MAX_PARTICIPANTS_PER_GROUP} personas.`,
    )
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

  test(`a group has at most ${MAX_EXPENSES_PER_GROUP} expenses, deleted ones included`, async () => {
    const { ana, group, me, n } = await newGroup()
    const other = await categoryId(`ana-lim-${n}`, group.id, 'OTHER')
    await prisma.expense.createMany({
      data: Array.from({ length: MAX_EXPENSES_PER_GROUP - 1 }, (_, i) => ({
        groupId: group.id,
        description: `G${i}`,
        categoryId: other,
        date: day,
        amountCents: 100,
        currency: 'ARS' as const,
        splitType: 'EQUAL' as const,
        paidById: me,
        createdById: `ana-lim-${n}`,
        deletedAt: i === 0 ? new Date() : null,
      })),
    })
    const expense = () =>
      ana.expenses.create({
        groupId: group.id,
        description: 'Pizza',
        date: day,
        amountCents: 100,
        currency: 'ARS',
        paidById: me,
        split: { type: 'EQUAL', participantIds: [me] },
      })
    await expense()
    await expect(expense()).rejects.toThrow('Un grupo puede tener hasta 5.000 gastos, contando los borrados.')
    expect(await prisma.expense.count({ where: { groupId: group.id } })).toBe(MAX_EXPENSES_PER_GROUP)
    // Deleting one doesn't make room: it still takes up space
    const [last] = (await ana.expenses.list({ groupId: group.id })).items
    await ana.expenses.delete({ expenseId: last!.id })
    await expect(expense()).rejects.toThrow('gastos, contando los borrados')
  })

  test(`a group has at most ${MAX_SETTLEMENTS_PER_GROUP} payments, deleted ones included`, async () => {
    const { ana, group, me, n } = await newGroup()
    const juan = await ana.participants.add({ groupId: group.id, name: 'Juan' })
    await prisma.settlement.createMany({
      data: Array.from({ length: MAX_SETTLEMENTS_PER_GROUP - 1 }, (_, i) => ({
        groupId: group.id,
        fromId: me,
        toId: juan.id,
        amountCents: 100,
        currency: 'ARS' as const,
        date: day,
        createdById: `ana-lim-${n}`,
        deletedAt: i === 0 ? new Date() : null,
      })),
    })
    const settlement = () =>
      ana.settlements.create({ groupId: group.id, fromId: juan.id, toId: me, amountCents: 100, currency: 'ARS', date: day })
    const last = await settlement()
    await expect(settlement()).rejects.toThrow('Un grupo puede tener hasta 5.000 pagos, contando los borrados.')
    expect(await prisma.settlement.count({ where: { groupId: group.id } })).toBe(MAX_SETTLEMENTS_PER_GROUP)
    // Deleting one doesn't make room: it still takes up space
    await ana.settlements.delete({ settlementId: last.id })
    await expect(settlement()).rejects.toThrow('pagos, contando los borrados')
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

describe('per-user limits', () => {
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

  test('invite codes have their own limit per user, whatever the network', async () => {
    const { group } = await newGroup()
    const user = `guess-lim-${n}`
    const fromHome = caller(user, '203.0.113.60')
    const fromWork = caller(user, '203.0.113.61')
    const code = { inviteCode: group.inviteCode }
    for (let i = 0; i < USER_PROCEDURE_RULES['groups.preview']!.limit; i++) await (i % 2 ? fromHome : fromWork).groups.preview(code)
    await expect(fromWork.groups.preview(code)).rejects.toThrow(RATE_LIMIT_MESSAGE)
    // Someone else on the same network isn't affected
    await caller(`other-guess-lim-${n}`, '203.0.113.60').groups.preview(code)

    // Joining counts on its own (here with a code that can't exist: 0 is never in one)
    const wrong = { inviteCode: '00000000', name: 'Eve' }
    for (let i = 0; i < USER_PROCEDURE_RULES['groups.join']!.limit; i++) {
      expect(await codeOf((i % 2 ? fromHome : fromWork).groups.join(wrong))).toBe('NOT_FOUND')
    }
    await expect(fromHome.groups.join({ ...code, name: 'Eve' })).rejects.toThrow(RATE_LIMIT_MESSAGE)
  })

  test(`each user creates at most ${USER_CREATION_RULE.limit} things per day, between every creating mutation`, async () => {
    const other = await newGroup()
    const ip = '203.0.113.70'
    const busy = caller(`busy-lim-${n}`, ip)
    // Fake clock: a couple of minutes every 25 writes, so the per-minute write limit doesn't kick in first.
    const start = Date.now()
    let minutes = 0
    const tick = () => setSystemTime(new Date(start + (minutes += 2) * 60_000))
    setSystemTime(new Date(start))
    try {
      const own = await busy.groups.create({ name: 'Mío', baseCurrency: 'ARS', myName: 'Yo' })
      const me = (await busy.groups.get({ groupId: own.id })).myParticipantId
      const juan = await busy.participants.add({ groupId: own.id, name: 'Juan' })
      const pay = () =>
        busy.settlements.create({ groupId: own.id, fromId: juan.id, toId: me, amountCents: 100, currency: 'ARS', date: day })
      for (let created = 2; created < USER_CREATION_RULE.limit; created++) {
        if (created % 25 === 0) tick()
        await pay()
      }
      tick()
      const attempts: Record<string, () => Promise<unknown>> = {
        'groups.create': () => busy.groups.create({ name: 'Otro', baseCurrency: 'ARS', myName: 'Yo' }),
        'groups.join': () => busy.groups.join({ inviteCode: other.group.inviteCode, name: 'Yo' }),
        'participants.add': () => busy.participants.add({ groupId: own.id, name: 'Beto' }),
        'categories.create': () => busy.categories.create({ groupId: own.id, name: 'Nafta', icon: 'fuel', color: 'teal' }),
        'expenses.create': () =>
          busy.expenses.create({
            groupId: own.id,
            description: 'Pizza',
            date: day,
            amountCents: 100,
            currency: 'ARS',
            paidById: me,
            split: { type: 'EQUAL', participantIds: [me] },
          }),
        'settlements.create': pay,
        'savedFilters.create': () => busy.savedFilters.create({ groupId: own.id, name: 'Míos', filters: {} }),
      }
      expect(Object.keys(attempts).sort()).toEqual([...CREATING_PROCEDURES].sort())
      for (const attempt of Object.values(attempts)) await expect(attempt()).rejects.toThrow(CREATION_LIMIT_MESSAGE)

      // Reads, updates and deletes still work, and other users can still create
      const [last] = await busy.settlements.list({ groupId: own.id })
      await busy.settlements.delete({ settlementId: last!.id })
      await busy.groups.rename({ groupId: own.id, name: 'Renombrado' })
      await caller(`calm-lim-${n}`, ip).groups.create({ name: 'Tranqui', baseCurrency: 'ARS', myName: 'Yo' })
      // The next day it starts over
      setSystemTime(new Date(start + USER_CREATION_RULE.windowMs + 60 * 60_000))
      await pay()
    } finally {
      setSystemTime()
    }
  })
})

describe('database size guard (MAX_DB_MB)', () => {
  test('over MAX_DB_MB, creating anything is rejected; reads, updates and deletes keep working', async () => {
    const { ana, group, me } = await newGroup()
    const juan = await ana.participants.add({ groupId: group.id, name: 'Juan' })
    const payment = await ana.settlements.create({
      groupId: group.id,
      fromId: juan.id,
      toId: me,
      amountCents: 100,
      currency: 'ARS',
      date: day,
    })
    process.env.MAX_DB_MB = '1' // an empty test database already takes a few MB
    try {
      const expense = ana.expenses.create({
        groupId: group.id,
        description: 'Pizza',
        date: day,
        amountCents: 100,
        currency: 'ARS',
        paidById: me,
        split: { type: 'EQUAL', participantIds: [me] },
      })
      await expect(expense).rejects.toThrow(DB_FULL_MESSAGE)
      expect(await codeOf(ana.groups.create({ name: 'Otro', baseCurrency: 'ARS', myName: 'Ana' }))).toBe('SERVICE_UNAVAILABLE')
      expect(await codeOf(caller(`new-db-${n}`).groups.join({ inviteCode: group.inviteCode, name: 'Beto' }))).toBe('SERVICE_UNAVAILABLE')

      await ana.groups.rename({ groupId: group.id, name: 'Sigue andando' })
      await ana.settlements.delete({ settlementId: payment.id })
      expect((await ana.groups.get({ groupId: group.id })).name).toBe('Sigue andando')

      // Under the limit (the size read a moment ago is reused), creating works again
      process.env.MAX_DB_MB = '100000'
      await ana.participants.add({ groupId: group.id, name: 'Beto' })
    } finally {
      delete process.env.MAX_DB_MB
    }
  })
})
