// "Novedades": a change to an expense or a payment reaches the people involved in it (with an
// account), except whoever made it (root CLAUDE.md → "Notificaciones").
import { describe, expect, test } from 'bun:test'
import { MAX_NOTIFICATIONS_PER_USER } from '../../lib/notifications'
import { setupTestApi } from './setup'

const { caller, anonymous, prisma } = await setupTestApi()

let n = 0
// Ana, Beto and Cami in "Viaje", plus Juan (no account). Dani has an account but isn't in the group.
async function scenario() {
  n += 1
  const ana = caller(`ana-${n}`)
  const beto = caller(`beto-${n}`)
  const cami = caller(`cami-${n}`)
  const dani = caller(`dani-${n}`)
  const group = await ana.groups.create({ name: 'Viaje', baseCurrency: 'ARS', myName: 'Ana' })
  await beto.groups.join({ inviteCode: group.inviteCode, name: 'Beto' })
  await cami.groups.join({ inviteCode: group.inviteCode, name: 'Cami' })
  const juan = await ana.participants.add({ groupId: group.id, name: 'Juan' })
  const ids = Object.fromEntries((await ana.groups.get({ groupId: group.id })).participants.map((p) => [p.name, p.id]))
  const expense = (description: string, paidById: string, participantIds: string[]) => ({
    groupId: group.id,
    description,
    date: new Date('2026-11-20T12:00:00Z'),
    amountCents: 3000,
    currency: 'ARS' as const,
    paidById,
    split: { type: 'EQUAL' as const, participantIds },
  })
  const payment = (fromId: string, toId: string) => ({
    groupId: group.id,
    fromId,
    toId,
    amountCents: 1500,
    currency: 'ARS' as const,
    date: new Date('2026-11-21T12:00:00Z'),
  })
  const news = async (who: typeof ana) =>
    (await who.notifications.list()).map((x) => [x.kind, x.actor?.name, x.expense?.description ?? null])
  return { ana, beto, cami, dani, group, juan, ids: ids as Record<'Ana' | 'Beto' | 'Cami' | 'Juan', string>, expense, payment, news }
}

describe('notifications', () => {
  test('requires login', async () => {
    await expect(anonymous.notifications.list()).rejects.toThrow('UNAUTHORIZED')
    await expect(anonymous.notifications.unreadCount()).rejects.toThrow('UNAUTHORIZED')
    await expect(anonymous.notifications.markAllRead()).rejects.toThrow('UNAUTHORIZED')
  })

  test('a new expense reaches whoever paid and whoever is in the split, except who loaded it', async () => {
    const { ana, beto, cami, dani, ids, expense, news } = await scenario()
    await ana.expenses.create(expense('Cena', ids.Ana, [ids.Ana, ids.Beto, ids.Juan]))

    expect(await news(beto)).toEqual([['EXPENSE_CREATED', 'Ana', 'Cena']])
    // Not in it, not who loaded it, not in the group
    expect(await cami.notifications.list()).toEqual([])
    expect(await ana.notifications.list()).toEqual([])
    expect(await dani.notifications.list()).toEqual([])
  })

  test("who paid hears about it even if they're not in the split, and so does everyone in it", async () => {
    const { ana, beto, cami, ids, expense, news } = await scenario()
    // Ana loads a present Beto paid, only for Cami
    await ana.expenses.create(expense('Regalo', ids.Beto, [ids.Cami]))
    expect(await news(beto)).toEqual([['EXPENSE_CREATED', 'Ana', 'Regalo']])
    expect(await news(cami)).toEqual([['EXPENSE_CREATED', 'Ana', 'Regalo']])
    expect(await ana.notifications.list()).toEqual([])
  })

  test('an edit reaches who was in it and who is in it now', async () => {
    const { ana, beto, cami, ids, expense, news } = await scenario()
    const cena = await ana.expenses.create(expense('Cena', ids.Ana, [ids.Ana, ids.Beto]))
    await beto.notifications.markAllRead()
    // Beto out, Cami in
    await ana.expenses.update({ ...expense('Cena', ids.Ana, [ids.Ana, ids.Cami]), expenseId: cena.id })

    expect(await news(beto)).toEqual([
      ['EXPENSE_UPDATED', 'Ana', 'Cena'],
      ['EXPENSE_CREATED', 'Ana', 'Cena'],
    ])
    expect(await news(cami)).toEqual([['EXPENSE_UPDATED', 'Ana', 'Cena']])
  })

  test('a newer change replaces an unread one about the same expense (added + edited = still new)', async () => {
    const { ana, beto, cami, ids, expense, news } = await scenario()
    const cena = await ana.expenses.create(expense('Cena', ids.Ana, [ids.Ana, ids.Beto, ids.Cami]))
    await cami.notifications.markAllRead()
    await ana.expenses.update({ ...expense('Cena con postre', ids.Ana, [ids.Ana, ids.Beto, ids.Cami]), expenseId: cena.id })
    await ana.expenses.update({ ...expense('Cena con postre y vino', ids.Ana, [ids.Ana, ids.Beto, ids.Cami]), expenseId: cena.id })

    // Beto hadn't seen it: one notification, still "agregó", with the expense as it is now
    expect(await news(beto)).toEqual([['EXPENSE_CREATED', 'Ana', 'Cena con postre y vino']])
    // Cami had seen it: the edits are new (one for both, the latest)
    expect(await news(cami)).toEqual([
      ['EXPENSE_UPDATED', 'Ana', 'Cena con postre y vino'],
      ['EXPENSE_CREATED', 'Ana', 'Cena con postre y vino'],
    ])

    // The unread one shows who made the latest change (the one already read stays as it was)
    await beto.expenses.update({ ...expense('Cena', ids.Ana, [ids.Ana, ids.Beto, ids.Cami]), expenseId: cena.id })
    expect(await news(cami)).toEqual([
      ['EXPENSE_UPDATED', 'Beto', 'Cena'],
      ['EXPENSE_CREATED', 'Ana', 'Cena'],
    ])
  })

  test('a deleted expense: "borró", and it still shows what it was', async () => {
    const { ana, beto, ids, expense } = await scenario()
    const cena = await ana.expenses.create(expense('Cena', ids.Ana, [ids.Ana, ids.Beto]))
    await beto.notifications.markAllRead()
    await ana.expenses.delete({ expenseId: cena.id })

    const [latest] = await beto.notifications.list()
    expect(latest).toMatchObject({
      kind: 'EXPENSE_DELETED',
      readAt: null,
      group: { name: 'Viaje' },
      actor: { name: 'Ana' },
      expense: { id: cena.id, description: 'Cena', amountCents: 3000, currency: 'ARS', category: { icon: expect.any(String) } },
    })
    expect(latest!.expense!.deletedAt).toBeInstanceOf(Date)
  })

  test('payments reach who paid and who got paid, except who registered it; "isMe" says which one I am', async () => {
    const { ana, beto, cami, ids, payment } = await scenario()
    // Ana registers that Beto paid Cami
    const paid = await ana.settlements.create(payment(ids.Beto, ids.Cami))

    const [forBeto] = await beto.notifications.list()
    expect(forBeto).toMatchObject({
      kind: 'SETTLEMENT_CREATED',
      actor: { name: 'Ana' },
      expense: null,
      settlement: {
        id: paid.id,
        amountCents: 1500,
        currency: 'ARS',
        from: { name: 'Beto', isMe: true },
        to: { name: 'Cami', isMe: false },
      },
    })
    const [forCami] = await cami.notifications.list()
    expect(forCami!.settlement).toMatchObject({ from: { isMe: false }, to: { isMe: true } })
    expect(await ana.notifications.list()).toEqual([])

    // Beto deletes it: Cami hears about it, Beto doesn't (he did it), Ana isn't in it
    await beto.settlements.delete({ settlementId: paid.id })
    expect((await cami.notifications.list()).map((x) => x.kind)).toEqual(['SETTLEMENT_DELETED'])
    expect((await beto.notifications.list()).map((x) => x.kind)).toEqual(['SETTLEMENT_CREATED'])
    expect(await ana.notifications.list()).toEqual([])
  })

  test('unread count, and opening "Novedades" marks them all as read (only mine)', async () => {
    const { ana, beto, cami, ids, expense, payment } = await scenario()
    await ana.expenses.create(expense('Cena', ids.Ana, [ids.Beto, ids.Cami]))
    await ana.expenses.create(expense('Taxi', ids.Ana, [ids.Beto]))
    await ana.settlements.create(payment(ids.Beto, ids.Ana))
    expect(await beto.notifications.unreadCount()).toBe(3)
    expect(await cami.notifications.unreadCount()).toBe(1)

    expect(await beto.notifications.markAllRead()).toEqual({ ok: true })
    expect(await beto.notifications.unreadCount()).toBe(0)
    expect((await beto.notifications.list()).every((x) => x.readAt instanceof Date)).toBe(true)
    // Cami's are still unread
    expect(await cami.notifications.unreadCount()).toBe(1)
  })

  test('each user keeps only their latest ones', async () => {
    const { ana, beto, ids, expense } = await scenario()
    for (let i = 1; i <= MAX_NOTIFICATIONS_PER_USER + 2; i++) await ana.expenses.create(expense(`Gasto ${i}`, ids.Ana, [ids.Beto]))

    const list = await beto.notifications.list()
    expect(list).toHaveLength(MAX_NOTIFICATIONS_PER_USER)
    expect(list[0]!.expense!.description).toBe(`Gasto ${MAX_NOTIFICATIONS_PER_USER + 2}`)
    expect(list.at(-1)!.expense!.description).toBe('Gasto 3')
    expect(await prisma.notification.count({ where: { userId: `beto-${n}` } })).toBe(MAX_NOTIFICATIONS_PER_USER)
  })

  test("only groups I'm still in", async () => {
    const { ana, beto, ids, expense } = await scenario()
    await ana.expenses.create(expense('Cena', ids.Ana, [ids.Beto]))
    expect(await beto.notifications.unreadCount()).toBe(1)
    // If Beto's participant were no longer his (today only deleting the account does that, and it
    // deletes his notifications too), he'd stop seeing the group's.
    await prisma.participant.update({ where: { id: ids.Beto }, data: { userId: null } })
    expect(await beto.notifications.list()).toEqual([])
    expect(await beto.notifications.unreadCount()).toBe(0)
  })

  test('if who made the change is removed from the group later, it shows without them', async () => {
    const { ana, beto, ids, expense } = await scenario()
    // Cami loads an expense she's not in, then her participant ends up without account and is removed
    const cami = caller(`cami-${n}`)
    await cami.expenses.create(expense('Nafta', ids.Juan, [ids.Juan, ids.Beto]))
    await prisma.participant.update({ where: { id: ids.Cami }, data: { userId: null } })
    await ana.participants.remove({ participantId: ids.Cami })

    expect(await beto.notifications.list()).toMatchObject([{ kind: 'EXPENSE_CREATED', actor: null, expense: { description: 'Nafta' } }])
  })
})
