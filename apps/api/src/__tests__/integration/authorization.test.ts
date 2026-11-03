// Security net: someone who is NOT a member of a group cannot read or change anything in it,
// through ANY procedure. If you add a procedure, this test fails until you add it to `attacks`
// (group-scoped) or to `notGroupScoped` (with the reason) — see "Seguridad" in apps/api/CLAUDE.md.
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
  'rates.blue': 'public exchange rate',
}

describe('authorization: non-members', () => {
  test('every procedure is either covered here or explicitly exempt', () => {
    const all = Object.keys(appRouter._def.procedures).sort()
    const listed = [...Object.keys(attacks), ...Object.keys(notGroupScoped)].sort()
    expect(listed).toEqual(all)
  })

  test.each(Object.keys(attacks))('%s → rejected (NOT_FOUND / FORBIDDEN)', async (name) => {
    const error = await attacks[name]!().then(
      () => null,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(TRPCError)
    expect(['NOT_FOUND', 'FORBIDDEN']).toContain((error as TRPCError).code)
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
  })
})
