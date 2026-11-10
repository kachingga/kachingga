// Security net: someone who is NOT a member of a group cannot read or change anything in it,
// through ANY procedure (always NOT_FOUND: it doesn't reveal that the group exists). If you add a
// procedure, this test fails until you add it to `attacks` (group-scoped) or to `notGroupScoped`
// (with the reason) — see "Seguridad" in apps/api/CLAUDE.md. Same idea below for archived groups:
// every mutation is rejected on one, or listed in `writableWhenArchived` with the reason.
import { describe, expect, test } from 'bun:test'
import { TRPCError } from '@trpc/server'
import { appRouter } from '../../trpc/router'
import { setupTestApi, stubBlueRate } from './setup'

const { caller } = await setupTestApi()
stubBlueRate()

const owner = caller('owner-authz')
const outsider = caller('outsider-authz')

const group = await owner.groups.create({ name: 'Privado', baseCurrency: 'ARS', myName: 'Dueño' })
const juan = await owner.participants.add({ groupId: group.id, name: 'Juan' })
const me = (await owner.groups.get({ groupId: group.id })).myParticipantId
const expense = await owner.expenses.create({
  groupId: group.id,
  description: 'Secreto',
  date: new Date('2026-11-01T12:00:00Z'),
  amountCents: 1000,
  currency: 'ARS',
  paidById: me,
  split: { type: 'EQUAL', participantIds: [me, juan.id] },
})
const settlement = await owner.settlements.create({
  groupId: group.id,
  fromId: juan.id,
  toId: me,
  amountCents: 500,
  currency: 'ARS',
  date: new Date(),
})
const saved = await owner.savedFilters.create({ groupId: group.id, name: 'Míos', filters: {} })
const category = await owner.categories.create({ groupId: group.id, name: 'Nafta', icon: 'fuel', color: 'teal' })

const expenseFields = {
  description: 'Hackeado',
  date: new Date(),
  amountCents: 1,
  currency: 'ARS' as const,
  paidById: me,
  split: { type: 'EQUAL' as const, participantIds: [me] },
}

// Every group-scoped procedure, called by the outsider against the owner's group.
const attacks: Record<string, () => Promise<unknown>> = {
  'groups.get': () => outsider.groups.get({ groupId: group.id }),
  'groups.rename': () => outsider.groups.rename({ groupId: group.id, name: 'Hackeado' }),
  'groups.setArchived': () => outsider.groups.setArchived({ groupId: group.id, archived: true }),
  'groups.regenerateInviteCode': () => outsider.groups.regenerateInviteCode({ groupId: group.id }),
  'participants.add': () => outsider.participants.add({ groupId: group.id, name: 'Intruso' }),
  'participants.rename': () => outsider.participants.rename({ participantId: juan.id, name: 'Hackeado' }),
  'participants.setPaymentAlias': () => outsider.participants.setPaymentAlias({ participantId: juan.id, paymentAlias: 'robo.mp' }),
  'participants.remove': () => outsider.participants.remove({ participantId: juan.id }),
  'expenses.list': () => outsider.expenses.list({ groupId: group.id }),
  'expenses.export': () => outsider.expenses.export({ groupId: group.id, format: 'json' }),
  'expenses.summary': () => outsider.expenses.summary({ groupId: group.id }),
  'expenses.get': () => outsider.expenses.get({ expenseId: expense.id }),
  'expenses.create': () => outsider.expenses.create({ groupId: group.id, ...expenseFields }),
  'expenses.update': () => outsider.expenses.update({ expenseId: expense.id, ...expenseFields }),
  'expenses.delete': () => outsider.expenses.delete({ expenseId: expense.id }),
  'settlements.list': () => outsider.settlements.list({ groupId: group.id }),
  'settlements.create': () =>
    outsider.settlements.create({ groupId: group.id, fromId: me, toId: juan.id, amountCents: 1, currency: 'ARS', date: new Date() }),
  'settlements.delete': () => outsider.settlements.delete({ settlementId: settlement.id }),
  'balances.get': () => outsider.balances.get({ groupId: group.id }),
  'savedFilters.list': () => outsider.savedFilters.list({ groupId: group.id }),
  'savedFilters.create': () => outsider.savedFilters.create({ groupId: group.id, name: 'X', filters: {} }),
  'savedFilters.delete': () => outsider.savedFilters.delete({ savedFilterId: saved.id }),
  'categories.list': () => outsider.categories.list({ groupId: group.id }),
  'categories.create': () => outsider.categories.create({ groupId: group.id, name: 'Intrusa', icon: 'shapes', color: 'cocoa' }),
  'categories.update': () => outsider.categories.update({ categoryId: category.id, name: 'Hackeada' }),
  'categories.archive': () => outsider.categories.archive({ categoryId: category.id }),
  'categories.unarchive': () => outsider.categories.unarchive({ categoryId: category.id }),
  'categories.suggest': () => outsider.categories.suggest({ groupId: group.id, description: 'Secreto' }),
}

// Procedures that don't take a group (or reach it only through the invite code, on purpose).
const notGroupScoped: Record<string, string> = {
  'health.ping': 'public liveness check',
  'health.me': 'only returns the caller',
  'groups.list': 'filtered to the caller (checked below)',
  'groups.create': 'creates a new group owned by the caller',
  'groups.preview': 'by invite code, on purpose (rate limited)',
  'groups.join': 'by invite code, on purpose (rate limited)',
  'profile.get': "only the caller's profile",
  'profile.update': "only the caller's profile",
  'profile.deleteAccount': "only the caller's account (takes no input; tested in deleteAccount.test.ts)",
  'rates.get': 'public exchange rate',
}

describe('authorization: non-members', () => {
  test('every procedure is either covered here or explicitly exempt', () => {
    const all = Object.keys(appRouter._def.procedures).sort()
    const listed = [...Object.keys(attacks), ...Object.keys(notGroupScoped)].sort()
    expect(listed).toEqual(all)
  })

  test.each(Object.keys(attacks))('%s → NOT_FOUND', async (name) => {
    const error = await attacks[name]!().then(
      () => null,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(TRPCError)
    expect((error as TRPCError).code).toBe('NOT_FOUND')
  })

  test("the outsider doesn't see the group in their list", async () => {
    expect(await outsider.groups.list({ includeArchived: true })).toEqual([])
  })

  test("the owner's data is untouched after all the attempts", async () => {
    const g = await owner.groups.get({ groupId: group.id })
    expect(g).toMatchObject({ name: 'Privado', inviteCode: group.inviteCode, archivedAt: null })
    expect(g.participants.map((p) => p.name)).toEqual(['Dueño', 'Juan'])
    expect(g.participants.find((p) => p.name === 'Juan')?.paymentAlias).toBeNull()
    expect((await owner.expenses.list({ groupId: group.id })).items.map((e) => e.description)).toEqual(['Secreto'])
    expect(await owner.settlements.list({ groupId: group.id })).toHaveLength(1)
    expect(await owner.savedFilters.list({ groupId: group.id })).toHaveLength(1)
    const categories = await owner.categories.list({ groupId: group.id })
    expect(categories.map((c) => c.name)).not.toContain('Intrusa')
    expect(categories.find((c) => c.id === category.id)).toMatchObject({ name: 'Nafta', archived: false })
  })

  test("a category of another group can't be used in an expense", async () => {
    const own = await outsider.groups.create({ name: 'Mío', baseCurrency: 'ARS', myName: 'Yo' })
    const myId = (await outsider.groups.get({ groupId: own.id })).myParticipantId
    await expect(
      outsider.expenses.create({
        groupId: own.id,
        ...expenseFields,
        paidById: myId,
        split: { type: 'EQUAL', participantIds: [myId] },
        categoryId: category.id,
      }),
    ).rejects.toThrow('no es del grupo')
  })
})

// An archived group with a bit of everything, to try every write on it.
const keeper = caller('owner-archived')
const shelved = await keeper.groups.create({ name: 'Archivado', baseCurrency: 'ARS', myName: 'Yo' })
const keeperId = (await keeper.groups.get({ groupId: shelved.id })).myParticipantId
const extra = await keeper.participants.add({ groupId: shelved.id, name: 'Extra' })
const mine = { paidById: keeperId, split: { type: 'EQUAL' as const, participantIds: [keeperId] } }
const oldExpense = await keeper.expenses.create({ groupId: shelved.id, ...expenseFields, ...mine, description: 'Viejo' })
const oldSettlement = await keeper.settlements.create({
  groupId: shelved.id,
  fromId: extra.id,
  toId: keeperId,
  amountCents: 100,
  currency: 'ARS',
  date: new Date(),
})
const [activeCategory, archivedCategory] = await keeper.categories.list({ groupId: shelved.id })
await keeper.categories.archive({ categoryId: archivedCategory!.id })
const oldFilter = await keeper.savedFilters.create({ groupId: shelved.id, name: 'Viejo', filters: {} })
await keeper.groups.setArchived({ groupId: shelved.id, archived: true })

const archivedWrites: Record<string, () => Promise<unknown>> = {
  'groups.rename': () => keeper.groups.rename({ groupId: shelved.id, name: 'Otro' }),
  'groups.regenerateInviteCode': () => keeper.groups.regenerateInviteCode({ groupId: shelved.id }),
  'groups.join': () => caller('newcomer-archived').groups.join({ inviteCode: shelved.inviteCode, name: 'Nuevo' }),
  'participants.add': () => keeper.participants.add({ groupId: shelved.id, name: 'Otro' }),
  'participants.rename': () => keeper.participants.rename({ participantId: extra.id, name: 'Otro' }),
  'participants.setPaymentAlias': () => keeper.participants.setPaymentAlias({ participantId: keeperId, paymentAlias: 'yo.cobro' }),
  'participants.remove': () => keeper.participants.remove({ participantId: extra.id }),
  'expenses.create': () => keeper.expenses.create({ groupId: shelved.id, ...expenseFields, ...mine }),
  'expenses.update': () => keeper.expenses.update({ expenseId: oldExpense.id, ...expenseFields, ...mine }),
  'expenses.delete': () => keeper.expenses.delete({ expenseId: oldExpense.id }),
  'settlements.create': () =>
    keeper.settlements.create({ groupId: shelved.id, fromId: keeperId, toId: extra.id, amountCents: 1, currency: 'ARS', date: new Date() }),
  'settlements.delete': () => keeper.settlements.delete({ settlementId: oldSettlement.id }),
  'categories.create': () => keeper.categories.create({ groupId: shelved.id, name: 'Nueva', icon: 'shapes', color: 'cocoa' }),
  'categories.update': () => keeper.categories.update({ categoryId: activeCategory!.id, name: 'Otra' }),
  'categories.archive': () => keeper.categories.archive({ categoryId: activeCategory!.id }),
  'categories.unarchive': () => keeper.categories.unarchive({ categoryId: archivedCategory!.id }),
}

// Mutations that work on an archived group, on purpose.
const writableWhenArchived: Record<string, string> = {
  'groups.setArchived': 'the way to unarchive it',
  'groups.create': 'creates a new group',
  'profile.update': "the account's alias, not group-scoped",
  'savedFilters.create': 'personal way of reading the expenses, not group data',
  'savedFilters.delete': 'personal way of reading the expenses, not group data',
}

describe('archived group: read-only', () => {
  test('every mutation is either rejected on an archived group or explicitly allowed', () => {
    const procedures = appRouter._def.procedures as unknown as Record<string, { _def: { type: string } }>
    const mutations = Object.entries(procedures)
      .filter(([, procedure]) => procedure._def.type === 'mutation')
      .map(([name]) => name)
      .sort()
    expect([...Object.keys(archivedWrites), ...Object.keys(writableWhenArchived)].sort()).toEqual(mutations)
  })

  test.each(Object.keys(archivedWrites))('%s → rejected', async (name) => {
    const error = await archivedWrites[name]!().then(
      () => null,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(TRPCError)
    // Joining by code answers like an invalid code; everything else says it's archived
    expect((error as TRPCError).message).toBe(name === 'groups.join' ? 'Código inválido' : 'El grupo está archivado')
  })

  test('nothing changed, and it can still be read', async () => {
    const g = await keeper.groups.get({ groupId: shelved.id })
    expect(g).toMatchObject({ name: 'Archivado', inviteCode: shelved.inviteCode })
    expect(g.participants.map((p) => p.name)).toEqual(['Yo', 'Extra'])
    expect((await keeper.expenses.list({ groupId: shelved.id })).items.map((e) => e.description)).toEqual(['Viejo'])
    expect(await keeper.settlements.list({ groupId: shelved.id })).toHaveLength(1)
    const categories = await keeper.categories.list({ groupId: shelved.id })
    expect(categories).toHaveLength(8)
    expect(categories.filter((c) => c.archived).map((c) => c.id)).toEqual([archivedCategory!.id])
  })

  test('saved filters still work (personal, not group data)', async () => {
    await keeper.savedFilters.create({ groupId: shelved.id, name: 'Nuevo', filters: {} })
    await keeper.savedFilters.delete({ savedFilterId: oldFilter.id })
    expect((await keeper.savedFilters.list({ groupId: shelved.id })).map((f) => f.name)).toEqual(['Nuevo'])
  })
})
