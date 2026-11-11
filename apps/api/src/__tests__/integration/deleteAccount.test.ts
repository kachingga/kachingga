// Borrar mi cuenta: la persona se desvincula de sus grupos, no se borra de ellos (#104).
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { setupTestApi } from './setup'

// Supabase's admin API, faked (no network): set up before setupTestApi imports the router.
const deleteUser = mock(async (_userId: string, _softDelete?: boolean) => ({ data: { user: null }, error: null as Error | null }))
mock.module('../../lib/supabase', () => ({ getSupabase: () => ({ auth: { admin: { deleteUser } } }) }))

const { caller, signedInCaller, anonymous, prisma } = await setupTestApi()
beforeEach(() => deleteUser.mockClear())

const day = (d: string) => new Date(`2026-11-${d}T12:00:00Z`)
let n = 0

// Ana is "Ana" in Viaje (Beto's group too) and "Anita" in Depto (Beto's), with expenses, a payment,
// a kept-in-USD expense, aliases (account and group) and saved filters in both groups.
async function scenario() {
  n += 1
  const anaId = `ana-${n}`
  const betoId = `beto-${n}`
  // Both just signed in again (password or Google), as the web does right before deleting
  const ana = signedInCaller(anaId)
  const beto = signedInCaller(betoId)

  const viaje = await ana.groups.create({ name: 'Viaje', baseCurrency: 'ARS', myName: 'Ana' })
  await beto.groups.join({ inviteCode: viaje.inviteCode, name: 'Beto' })
  const depto = await beto.groups.create({ name: 'Depto', baseCurrency: 'ARS', myName: 'Beto' })
  await ana.groups.join({ inviteCode: depto.inviteCode, name: 'Anita' })

  const idIn = async (groupId: string, name: string) => (await beto.groups.get({ groupId })).participants.find((p) => p.name === name)!.id
  const [anaV, betoV, anaD, betoD] = await Promise.all([
    idIn(viaje.id, 'Ana'),
    idIn(viaje.id, 'Beto'),
    idIn(depto.id, 'Anita'),
    idIn(depto.id, 'Beto'),
  ])

  // Viaje: Beto paid 1000 between both (Ana owes 500); Ana paid USD 20 kept in USD (Beto owes USD 10)
  await beto.expenses.create({
    groupId: viaje.id,
    description: 'Cena',
    date: day('01'),
    amountCents: 1000,
    currency: 'ARS',
    paidById: betoV,
    split: { type: 'EQUAL', participantIds: [anaV, betoV] },
  })
  await ana.expenses.create({
    groupId: viaje.id,
    description: 'Nafta',
    date: day('02'),
    amountCents: 2000,
    currency: 'USD',
    keepCurrency: true,
    paidById: anaV,
    split: { type: 'EQUAL', participantIds: [anaV, betoV] },
  })
  // Depto: Ana paid Beto 300 (Beto owes her 300)
  await ana.settlements.create({ groupId: depto.id, fromId: anaD, toId: betoD, amountCents: 300, currency: 'ARS', date: day('03') })

  await ana.profile.update({ paymentAlias: 'ana.mp' })
  await ana.participants.setPaymentAlias({ participantId: anaV, paymentAlias: 'ana.viajes' })
  await beto.profile.update({ paymentAlias: 'beto.mp' })
  await beto.participants.setPaymentAlias({ participantId: betoV, paymentAlias: 'beto.viajes' })
  await ana.savedFilters.create({ groupId: viaje.id, name: 'Mis gastos', filters: { involvedParticipantId: anaV } })
  await ana.savedFilters.create({ groupId: depto.id, name: 'Míos', filters: {} })
  await beto.savedFilters.create({ groupId: viaje.id, name: 'De Beto', filters: {} })

  // Everything a group member sees, to compare before and after (balances in a fixed order: the
  // API returns participants in whatever order the DB gives).
  const groupView = async (groupId: string) => ({
    balances: (await beto.balances.get({ groupId })).map((b) => ({
      ...b,
      balances: b.balances.toSorted((x, y) => x.participantId.localeCompare(y.participantId)),
    })),
    expenses: await beto.expenses.list({ groupId }),
    settlements: await beto.settlements.list({ groupId }),
  })

  return { anaId, betoId, ana, beto, viaje, depto, anaV, betoV, anaD, groupView }
}

describe('profile.deleteAccount', () => {
  test('requires login (and never reaches Supabase)', async () => {
    await expect(anonymous.profile.deleteAccount()).rejects.toThrow('UNAUTHORIZED')
    expect(deleteUser).not.toHaveBeenCalled()
  })

  describe('only right after signing in again (password or Google)', () => {
    const minutesAgo = (minutes: number) => Math.floor(Date.now() / 1000) - minutes * 60

    test.each([
      ['a session that was never signed in with the password or Google (e.g. a mail link)', undefined],
      ['a session signed in 6 minutes ago', minutesAgo(6)],
      ['a session signed in yesterday (the token refreshed since)', minutesAgo(24 * 60)],
    ])('%s → rejected, and nothing changes', async (_case, signedInAt) => {
      const { anaId, viaje, anaV, groupView } = await scenario()
      const before = await groupView(viaje.id)
      const stale = signedInAt === undefined ? caller(anaId) : signedInCaller(anaId, signedInAt)

      const error = await stale.profile.deleteAccount().catch((e: unknown) => e)
      expect(error).toMatchObject({ code: 'FORBIDDEN', message: 'Para borrar tu cuenta, primero confirmá que sos vos.' })

      expect(deleteUser).not.toHaveBeenCalled()
      expect(await prisma.participant.findUnique({ where: { id: anaV } })).toMatchObject({ userId: anaId, paymentAlias: 'ana.viajes' })
      expect(await prisma.userProfile.findUnique({ where: { userId: anaId } })).toMatchObject({ paymentAlias: 'ana.mp' })
      expect(await prisma.savedFilter.count({ where: { userId: anaId } })).toBe(2)
      expect(await groupView(viaje.id)).toEqual(before)
    })

    test('signed in 4 minutes ago → deleted', async () => {
      const { anaId } = await scenario()
      expect(await signedInCaller(anaId, minutesAgo(4)).profile.deleteAccount()).toEqual({ ok: true })
      expect(deleteUser).toHaveBeenCalledWith(anaId, true)
    })
  })

  test('unlinks me from every group: I stay as a participant without account, with my expenses and balances', async () => {
    const { anaId, ana, beto, viaje, depto, anaV, groupView } = await scenario()
    const before = { viaje: await groupView(viaje.id), depto: await groupView(depto.id) }

    expect(await ana.profile.deleteAccount()).toEqual({ ok: true })

    // Supabase: soft delete of my own user
    expect(deleteUser).toHaveBeenCalledTimes(1)
    expect(deleteUser).toHaveBeenCalledWith(anaId, true)

    // Groups, expenses, payments and balances, exactly as they were
    expect(await groupView(viaje.id)).toEqual(before.viaje)
    expect(await groupView(depto.id)).toEqual(before.depto)

    // Same person, same name, now without account and without alias
    const inViaje = (await beto.groups.get({ groupId: viaje.id })).participants
    expect(inViaje.find((p) => p.id === anaV)).toMatchObject({
      name: 'Ana',
      hasAccount: false,
      paymentAlias: null,
      paymentAliasSource: null,
    })
    const inDepto = (await beto.groups.get({ groupId: depto.id })).participants
    expect(inDepto.find((p) => p.name === 'Anita')).toMatchObject({ hasAccount: false, paymentAlias: null })
    expect(await prisma.participant.count({ where: { userId: anaId } })).toBe(0)
    expect(await prisma.participant.count({ where: { groupId: { in: [viaje.id, depto.id] } } })).toBe(4)

    // What was only mine is gone: account alias, group alias and saved filters
    expect(await prisma.userProfile.findUnique({ where: { userId: anaId } })).toBeNull()
    expect(await prisma.participant.findUnique({ where: { id: anaV } })).toMatchObject({ userId: null, paymentAlias: null })
    expect(await prisma.savedFilter.count({ where: { userId: anaId } })).toBe(0)

    // Who created things stays as history
    expect(await prisma.group.findUnique({ where: { id: viaje.id } })).toMatchObject({ createdById: anaId })
    expect(await prisma.expense.count({ where: { createdById: anaId } })).toBe(1)
    expect(await prisma.settlement.count({ where: { createdById: anaId } })).toBe(1)

    // I'm in no group anymore
    expect(await ana.groups.list({ includeArchived: true })).toEqual([])
  })

  test("other people's data is untouched", async () => {
    const { ana, beto, viaje, betoV } = await scenario()
    await ana.profile.deleteAccount()

    expect(await beto.profile.get()).toEqual({ paymentAlias: 'beto.mp' })
    const me = (await beto.groups.get({ groupId: viaje.id })).participants.find((p) => p.id === betoV)
    expect(me).toMatchObject({ hasAccount: true, isMe: true, paymentAlias: 'beto.viajes', paymentAliasSource: 'group' })
    expect((await beto.savedFilters.list({ groupId: viaje.id })).map((f) => f.name)).toEqual(['De Beto'])
    expect((await beto.groups.list()).map((g) => g.name).sort()).toEqual(['Depto', 'Viaje'])
  })

  test("nobody can delete someone else's account: there is no user id in the input, it's always the caller", async () => {
    const { anaId, betoId, ana, beto, viaje } = await scenario()
    const deleteWithInput = beto.profile.deleteAccount as unknown as (input: unknown) => Promise<unknown>
    await deleteWithInput({ userId: anaId })

    expect(deleteUser).toHaveBeenCalledTimes(1)
    expect(deleteUser).toHaveBeenCalledWith(betoId, true)
    // Ana is still herself, everywhere
    expect((await ana.groups.list()).map((g) => g.name).sort()).toEqual(['Depto', 'Viaje'])
    expect(await ana.profile.get()).toEqual({ paymentAlias: 'ana.mp' })
    expect(await ana.savedFilters.list({ groupId: viaje.id })).toHaveLength(1)
  })

  test('if Supabase fails: clear error, I am already unlinked, and retrying finishes the job', async () => {
    const { anaId, ana, beto, viaje, anaV, groupView } = await scenario()
    const before = await groupView(viaje.id)
    deleteUser.mockImplementationOnce(async () => ({ data: { user: null }, error: new Error('Supabase caído') }))

    const error = await ana.profile.deleteAccount().catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: 'No se pudo terminar de borrar la cuenta. Intentá de nuevo.' })
    // Never an account still linked to a group, even halfway
    expect(await prisma.participant.count({ where: { userId: anaId } })).toBe(0)

    expect(await ana.profile.deleteAccount()).toEqual({ ok: true })
    expect(deleteUser).toHaveBeenCalledTimes(2)
    expect(deleteUser).toHaveBeenLastCalledWith(anaId, true)
    expect(await groupView(viaje.id)).toEqual(before)
    expect((await beto.groups.get({ groupId: viaje.id })).participants.find((p) => p.id === anaV)).toMatchObject({
      name: 'Ana',
      hasAccount: false,
    })
  })

  test('the unlinked participant can be claimed again with the code, with its balances', async () => {
    const { ana, viaje } = await scenario()
    await ana.profile.deleteAccount()

    const back = caller(`ana-vuelve-${n}`)
    const preview = await back.groups.preview({ inviteCode: viaje.inviteCode })
    const unclaimed = preview.unclaimedParticipants.find((p) => p.name === 'Ana')!
    expect(unclaimed).toBeDefined()
    await back.groups.join({ inviteCode: viaje.inviteCode, participantId: unclaimed.id })

    const [mine] = await back.groups.list()
    expect(mine).toMatchObject({ name: 'Viaje', myName: 'Ana', myBalanceCents: -500 })
  })
})

describe('groups.list: what I leave pending (shown before deleting the account)', () => {
  test('my name and my non-zero balances in every currency of each group, base first', async () => {
    const { ana, beto } = await scenario()
    const byName = Object.fromEntries((await ana.groups.list({ includeArchived: true })).map((g) => [g.name, g]))
    expect(byName.Viaje).toMatchObject({
      myName: 'Ana',
      myBalanceCents: -500,
      myBalances: [
        { currency: 'ARS', amountCents: -500 },
        { currency: 'USD', amountCents: 1000 },
      ],
    })
    expect(byName.Depto).toMatchObject({ myName: 'Anita', myBalanceCents: 300, myBalances: [{ currency: 'ARS', amountCents: 300 }] })

    // A group where I'm even: no pending balances
    const asado = await beto.groups.create({ name: 'Asado', baseCurrency: 'ARS', myName: 'Beto' })
    const [justCreated] = (await beto.groups.list()).filter((g) => g.id === asado.id)
    expect(justCreated).toMatchObject({ myName: 'Beto', myBalanceCents: 0, myBalances: [] })
  })
})
