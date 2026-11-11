// The account id (Supabase) of one member never reaches another: no response carries `userId` or
// `createdById` of someone else (any member can rename anyone, edit any expense…). Every procedure is
// called by a member on things another member created; a new procedure fails the first test until
// it's added to `calls` (or to `exempt`, with the reason).
import { describe, expect, test } from 'bun:test'
import { appRouter } from '../../trpc/router'
import { setupTestApi, stubBlueRate } from './setup'

const { caller, prisma } = await setupTestApi()
stubBlueRate()

const OWNER_ID = 'owner-account-0b5e9f'
const owner = caller(OWNER_ID)
const member = caller('member-account-7c1d')

const group = await owner.groups.create({ name: 'Viaje', baseCurrency: 'ARS', myName: 'Dueño' })
const groupId = group.id
await member.groups.join({ inviteCode: group.inviteCode, name: 'Miembro' })
const ownerParticipantId = (await owner.groups.get({ groupId })).myParticipantId
const memberParticipantId = (await member.groups.get({ groupId })).myParticipantId
const juan = await owner.participants.add({ groupId, name: 'Juan' })

const expenseInput = {
  groupId,
  description: 'Cena',
  date: new Date('2026-11-01T12:00:00Z'),
  amountCents: 3000,
  currency: 'ARS' as const,
  paidById: ownerParticipantId,
  split: { type: 'EQUAL' as const, participantIds: [ownerParticipantId, memberParticipantId, juan.id] },
}
const expense = await owner.expenses.create(expenseInput)
const settlementInput = {
  groupId,
  fromId: memberParticipantId,
  toId: ownerParticipantId,
  amountCents: 1000,
  currency: 'ARS' as const,
  date: new Date(),
}
await owner.settlements.create(settlementInput)
const category = await owner.categories.create({ groupId, name: 'Nafta', icon: 'fuel', color: 'teal' })

const inviteCode = async () => (await member.groups.get({ groupId })).inviteCode

// Every procedure, called by the member (most of them on what the owner created).
const calls: Record<string, () => Promise<unknown>> = {
  'health.ping': () => member.health.ping(),
  'health.me': () => member.health.me(),
  'groups.list': () => member.groups.list({ includeArchived: true }),
  'groups.get': () => member.groups.get({ groupId }),
  'groups.create': () => member.groups.create({ name: 'Otro', baseCurrency: 'ARS', myName: 'Yo' }),
  'groups.rename': () => member.groups.rename({ groupId, name: 'Viaje al sur' }),
  'groups.setArchived': () => member.groups.setArchived({ groupId, archived: false }),
  'groups.regenerateInviteCode': () => member.groups.regenerateInviteCode({ groupId }),
  'groups.preview': async () => member.groups.preview({ inviteCode: await inviteCode() }),
  'groups.join': async () => caller('third-account').groups.join({ inviteCode: await inviteCode(), name: 'Tercero' }),
  'participants.add': () => member.participants.add({ groupId, name: 'Pepe' }),
  'participants.rename': () => member.participants.rename({ participantId: ownerParticipantId, name: 'El dueño' }),
  'participants.setPaymentAlias': () =>
    member.participants.setPaymentAlias({ participantId: memberParticipantId, paymentAlias: 'miembro.mp' }),
  'participants.remove': async () =>
    member.participants.remove({ participantId: (await owner.participants.add({ groupId, name: 'Nadie' })).id }),
  'expenses.list': () => member.expenses.list({ groupId }),
  'expenses.export': async () => [
    await member.expenses.export({ groupId, format: 'json' }),
    await member.expenses.export({ groupId, format: 'csv' }),
  ],
  'expenses.summary': () => member.expenses.summary({ groupId }),
  'expenses.get': () => member.expenses.get({ expenseId: expense.id }),
  'expenses.create': () => member.expenses.create(expenseInput),
  'expenses.update': () => member.expenses.update({ ...expenseInput, expenseId: expense.id, description: 'Cena larga' }),
  'expenses.delete': async () => member.expenses.delete({ expenseId: (await owner.expenses.create(expenseInput)).id }),
  'settlements.list': () => member.settlements.list({ groupId }),
  'settlements.create': () => member.settlements.create(settlementInput),
  'settlements.delete': async () => member.settlements.delete({ settlementId: (await owner.settlements.create(settlementInput)).id }),
  'balances.get': () => member.balances.get({ groupId }),
  'savedFilters.list': () => member.savedFilters.list({ groupId }),
  'savedFilters.create': () => member.savedFilters.create({ groupId, name: 'Míos', filters: {} }),
  'savedFilters.delete': async () =>
    member.savedFilters.delete({ savedFilterId: (await member.savedFilters.create({ groupId, name: 'Borrar', filters: {} })).id }),
  'categories.list': () => member.categories.list({ groupId }),
  'categories.create': () => member.categories.create({ groupId, name: 'Peajes', icon: 'shapes', color: 'cocoa' }),
  'categories.update': () => member.categories.update({ categoryId: category.id, name: 'Combustible' }),
  'categories.archive': () => member.categories.archive({ categoryId: category.id }),
  'categories.unarchive': () => member.categories.unarchive({ categoryId: category.id }),
  'categories.suggest': () => member.categories.suggest({ groupId, description: 'Cena' }),
  'profile.get': () => member.profile.get(),
  'profile.update': () => member.profile.update({ paymentAlias: 'miembro.mp' }),
  'rates.get': () => member.rates.get({ currency: 'USD' }),
}

const exempt: Record<string, string> = {
  'profile.deleteAccount': 'returns only { ok } (needs Supabase: deleteAccount.test.ts)',
}

describe("no response carries another member's account id", () => {
  test('every procedure is either covered here or explicitly exempt', () => {
    const all = Object.keys(appRouter._def.procedures).sort()
    expect([...Object.keys(calls), ...Object.keys(exempt)].sort()).toEqual(all)
  })

  test("the owner's account id is in the database, where these responses come from", async () => {
    expect((await prisma.group.findUniqueOrThrow({ where: { id: groupId } })).createdById).toBe(OWNER_ID)
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: ownerParticipantId } })).userId).toBe(OWNER_ID)
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).createdById).toBe(OWNER_ID)
    expect((await prisma.settlement.findFirstOrThrow({ where: { groupId } })).createdById).toBe(OWNER_ID)
  })

  test.each(Object.keys(calls))('%s', async (name) => {
    expect(JSON.stringify(await calls[name]!())).not.toContain(OWNER_ID)
  })
})
