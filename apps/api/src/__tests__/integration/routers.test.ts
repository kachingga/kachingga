import { describe, expect, test } from 'bun:test'
import { setupTestApi, stubBlueRate } from './setup'

const { caller, anonymous } = await setupTestApi()
stubBlueRate()

let n = 0
// Fresh users per test so tests don't depend on each other.
const users = () => {
  n += 1
  return { ana: caller(`ana-${n}`), beto: caller(`beto-${n}`), eve: caller(`eve-${n}`) }
}

async function groupWithMembers() {
  const { ana, beto, eve } = users()
  const group = await ana.groups.create({ name: 'Viaje', baseCurrency: 'ARS', myName: 'Ana' })
  await beto.groups.join({ inviteCode: group.inviteCode, name: 'Beto' })
  const juan = await ana.participants.add({ groupId: group.id, name: 'Juan' })
  const full = await ana.groups.get({ groupId: group.id })
  const id = (name: string) => full.participants.find((p) => p.name === name)!.id
  const categories = await ana.categories.list({ groupId: group.id })
  const cat = (key: string) => categories.find((c) => c.defaultKey === key)!.id
  return { ana, beto, eve, group, juan, pAna: id('Ana'), pBeto: id('Beto'), pJuan: id('Juan'), cat }
}

const day = (d: string) => new Date(`2026-11-${d}T12:00:00Z`)

describe('auth', () => {
  test('everything except health.ping requires login', async () => {
    expect(await anonymous.health.ping()).toMatchObject({ ok: true })
    await expect(anonymous.groups.list()).rejects.toThrow('UNAUTHORIZED')
  })
})

describe('groups', () => {
  test('inside a group everything is visible to every member', async () => {
    const { ana, beto, group, pAna, pBeto, pJuan } = await groupWithMembers()
    await ana.expenses.create({
      groupId: group.id,
      description: 'Pagó Juan, cargó Ana',
      date: day('01'),
      amountCents: 1000,
      currency: 'ARS',
      paidById: pJuan,
      split: { type: 'EQUAL', participantIds: [pAna, pJuan] },
    })
    await ana.settlements.create({ groupId: group.id, fromId: pAna, toId: pJuan, amountCents: 500, currency: 'ARS', date: day('02') })
    // Beto is not involved in anything, but sees all of it
    expect((await beto.expenses.list({ groupId: group.id })).items.map((e) => e.description)).toEqual(['Pagó Juan, cargó Ana'])
    expect(await beto.settlements.list({ groupId: group.id })).toHaveLength(1)
    const [ars] = await beto.balances.get({ groupId: group.id })
    expect(ars!.balances.map((b) => b.participantId).sort()).toEqual([pAna, pBeto, pJuan].sort())
  })

  test('non-members cannot see a group (NOT_FOUND, no leak)', async () => {
    const { eve, group } = await groupWithMembers()
    await expect(eve.groups.get({ groupId: group.id })).rejects.toThrow('Grupo no encontrado')
    expect(await eve.groups.list()).toEqual([])
  })

  test('join: claim a participant without account, case-insensitive code, only once', async () => {
    const { ana, eve, group, juan } = await groupWithMembers()
    const preview = await eve.groups.preview({ inviteCode: group.inviteCode.toLowerCase() })
    expect(preview.unclaimedParticipants.map((p) => p.name)).toEqual(['Juan'])
    await eve.groups.join({ inviteCode: group.inviteCode, participantId: juan.id })
    const g = await eve.groups.get({ groupId: group.id })
    expect(g.participants.find((p) => p.isMe)?.name).toBe('Juan')
    await expect(eve.groups.join({ inviteCode: group.inviteCode, name: 'Otra' })).rejects.toThrow('Ya sos parte')
    const intruder = caller(`intruder-${n}`)
    await expect(intruder.groups.join({ inviteCode: group.inviteCode, participantId: juan.id })).rejects.toThrow('ya tiene cuenta')
    void ana
  })

  test('regenerating the invite code invalidates the old one', async () => {
    const { ana, eve, group } = await groupWithMembers()
    const updated = await ana.groups.regenerateInviteCode({ groupId: group.id })
    expect(updated.inviteCode).not.toBe(group.inviteCode)
    await expect(eve.groups.preview({ inviteCode: group.inviteCode })).rejects.toThrow('Código inválido')
  })

  test('archived groups are read-only until unarchived', async () => {
    const { ana, group, pAna } = await groupWithMembers()
    await ana.groups.setArchived({ groupId: group.id, archived: true })
    await expect(
      ana.expenses.create({
        groupId: group.id,
        description: 'x',
        date: day('01'),
        amountCents: 100,
        currency: 'ARS',
        paidById: pAna,
        split: { type: 'EQUAL', participantIds: [pAna] },
      }),
    ).rejects.toThrow('archivado')
    expect(await ana.groups.list()).toHaveLength(0)
    expect(await ana.groups.list({ includeArchived: true })).toHaveLength(1)
    await ana.groups.setArchived({ groupId: group.id, archived: false })
    expect(await ana.groups.list()).toHaveLength(1)
  })

  test('list returns my balance in the base currency of each group', async () => {
    const { ana, beto, group, pAna, pBeto, pJuan } = await groupWithMembers()
    // Ana pays 3000 among the three; a USD expense kept in USD doesn't count in the base balance.
    await ana.expenses.create({
      groupId: group.id,
      description: 'Cena',
      date: day('01'),
      amountCents: 3000,
      currency: 'ARS',
      paidById: pAna,
      split: { type: 'EQUAL', participantIds: [pAna, pBeto, pJuan] },
    })
    await ana.expenses.create({
      groupId: group.id,
      description: 'Taxi en USD',
      date: day('01'),
      amountCents: 600,
      currency: 'USD',
      keepCurrency: true,
      paidById: pBeto,
      split: { type: 'EQUAL', participantIds: [pAna, pBeto] },
    })
    await beto.settlements.create({ groupId: group.id, fromId: pBeto, toId: pAna, amountCents: 400, currency: 'ARS', date: day('02') })
    const other = await beto.groups.create({ name: 'Solo Beto', baseCurrency: 'USD', myName: 'Beto' })

    const [anaGroup] = await ana.groups.list()
    expect(anaGroup).toMatchObject({ id: group.id, myBalanceCents: 1600 })
    const betoGroups = await beto.groups.list()
    expect(betoGroups.find((g) => g.id === group.id)!.myBalanceCents).toBe(-600)
    expect(betoGroups.find((g) => g.id === other.id)!.myBalanceCents).toBe(0)
  })

  test('list returns the people of each group (id and name, oldest first) for its faces', async () => {
    const { ana, beto, group, pAna, pBeto, pJuan } = await groupWithMembers()
    const [anaGroup] = await ana.groups.list()
    expect(anaGroup!.participants).toEqual([
      { id: pAna, name: 'Ana' },
      { id: pBeto, name: 'Beto' },
      { id: pJuan, name: 'Juan' },
    ])
    // Beto sees the same people: inside a group everything is public to its members.
    const betoGroup = (await beto.groups.list()).find((g) => g.id === group.id)!
    expect(betoGroup.participants.map((p) => p.name)).toEqual(['Ana', 'Beto', 'Juan'])
  })
})

describe('participants', () => {
  test('can only remove people without account and without movements', async () => {
    const { ana, group, pAna, pBeto, pJuan } = await groupWithMembers()
    await expect(ana.participants.remove({ participantId: pBeto })).rejects.toThrow('ya tiene cuenta')
    await ana.expenses.create({
      groupId: group.id,
      description: 'Pizza',
      date: day('01'),
      amountCents: 1000,
      currency: 'ARS',
      paidById: pAna,
      split: { type: 'EQUAL', participantIds: [pAna, pJuan] },
    })
    await expect(ana.participants.remove({ participantId: pJuan })).rejects.toThrow('gastos o pagos')
    const extra = await ana.participants.add({ groupId: group.id, name: 'Extra' })
    expect(await ana.participants.remove({ participantId: extra.id })).toEqual({ ok: true })
  })
})

describe('expenses and balances', () => {
  test('full flow: ARS, converted USD (automatic blue), kept USD, settlement', async () => {
    const { ana, beto, group, pAna, pBeto, pJuan, cat } = await groupWithMembers()
    await ana.expenses.create({
      groupId: group.id,
      description: 'Asado',
      categoryId: cat('FOOD'),
      date: day('01'),
      amountCents: 300000,
      currency: 'ARS',
      paidById: pAna,
      split: { type: 'EQUAL', participantIds: [pAna, pBeto, pJuan] },
    })
    const nafta = await beto.expenses.create({
      groupId: group.id,
      description: 'Nafta',
      categoryId: cat('TRANSPORT'),
      date: day('02'),
      amountCents: 2000,
      currency: 'USD',
      paidById: pBeto,
      split: { type: 'EQUAL', participantIds: [pAna, pBeto] },
    })
    expect(nafta.exchangeRate).toBe(1555) // blue midpoint
    await beto.expenses.create({
      groupId: group.id,
      description: 'Cena',
      date: day('02'),
      amountCents: 6000,
      currency: 'USD',
      keepCurrency: true,
      paidById: pBeto,
      split: {
        type: 'PERCENTAGE',
        shares: [
          { participantId: pAna, percentage: 50 },
          { participantId: pJuan, percentage: 50 },
        ],
      },
    })

    const balances = await ana.balances.get({ groupId: group.id })
    expect(balances.map((b) => b.currency)).toEqual(['ARS', 'USD'])
    const ars = Object.fromEntries(balances[0]!.balances.map((b) => [b.participantId, b.amountCents]))
    expect(ars[pAna]).toBe(200000 - 1555000)
    expect(ars[pBeto]).toBe(-100000 + 1555000)
    expect(ars[pJuan]).toBe(-100000)
    for (const b of balances) expect(b.balances.reduce((a, x) => a + x.amountCents, 0)).toBe(0)

    await ana.settlements.create({ groupId: group.id, fromId: pJuan, toId: pAna, amountCents: 100000, currency: 'ARS', date: day('03') })
    const after = await ana.balances.get({ groupId: group.id })
    expect(after[0]!.balances.find((b) => b.participantId === pJuan)!.amountCents).toBe(0)
  })

  test('manual exchange rate wins over the automatic one', async () => {
    const { ana, group, pAna, pBeto } = await groupWithMembers()
    const e = await ana.expenses.create({
      groupId: group.id,
      description: 'Hotel',
      date: day('01'),
      amountCents: 10000,
      currency: 'USD',
      exchangeRate: 1500,
      paidById: pAna,
      split: { type: 'EQUAL', participantIds: [pAna, pBeto] },
    })
    expect(e.exchangeRate).toBe(1500)
  })

  test('rejects participants from another group', async () => {
    const { ana, group, pAna } = await groupWithMembers()
    const other = await groupWithMembers()
    await expect(
      ana.expenses.create({
        groupId: group.id,
        description: 'x',
        date: day('01'),
        amountCents: 100,
        currency: 'ARS',
        paidById: pAna,
        split: { type: 'EQUAL', participantIds: [other.pAna] },
      }),
    ).rejects.toThrow('no son del grupo')
  })

  test('update replaces splits; delete hides it from lists and balances', async () => {
    const { ana, group, pAna, pBeto, pJuan } = await groupWithMembers()
    const e = await ana.expenses.create({
      groupId: group.id,
      description: 'Super',
      date: day('01'),
      amountCents: 900,
      currency: 'ARS',
      paidById: pAna,
      split: { type: 'EQUAL', participantIds: [pAna, pBeto, pJuan] },
    })
    const updated = await ana.expenses.update({
      expenseId: e.id,
      description: 'Super',
      date: day('01'),
      amountCents: 1000,
      currency: 'ARS',
      paidById: pAna,
      split: { type: 'AMOUNT', shares: [{ participantId: pBeto, amountCents: 1000 }] },
    })
    expect(updated.splits.map((s) => [s.participantId, s.amountCents])).toEqual([[pBeto, 1000]])
    await ana.expenses.delete({ expenseId: e.id })
    expect((await ana.expenses.list({ groupId: group.id })).items).toEqual([])
    await expect(ana.expenses.get({ expenseId: e.id })).rejects.toThrow('no encontrado')
    const [ars] = await ana.balances.get({ groupId: group.id })
    expect(ars!.balances.every((b) => b.amountCents === 0)).toBe(true)
  })

  test('list: combined filters and cursor pagination', async () => {
    const { ana, group, pAna, pJuan, cat } = await groupWithMembers()
    for (let i = 0; i < 55; i++) {
      await ana.expenses.create({
        groupId: group.id,
        description: i === 8 ? 'Asado del sábado' : `Gasto ${i}`,
        categoryId: cat(i === 8 ? 'FOOD' : 'OTHER'),
        date: day('01'),
        amountCents: 100 + i,
        currency: 'ARS',
        paidById: pAna,
        split: { type: 'EQUAL', participantIds: i % 2 ? [pAna] : [pAna, pJuan] },
      })
    }
    const first = await ana.expenses.list({ groupId: group.id })
    expect(first.items).toHaveLength(50)
    const second = await ana.expenses.list({ groupId: group.id, cursor: first.nextCursor })
    expect(second.items).toHaveLength(5)
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.items, ...second.items].map((e) => e.id)).size).toBe(55)

    const search = await ana.expenses.list({
      groupId: group.id,
      filters: { search: 'ASADO', categoryIds: [cat('FOOD')], splitParticipantId: pJuan },
    })
    expect(search.items.map((e) => e.description)).toEqual(['Asado del sábado'])
  })
})

describe('settlements', () => {
  test('must be between two different people of the group', async () => {
    const { ana, group, pAna } = await groupWithMembers()
    await expect(
      ana.settlements.create({ groupId: group.id, fromId: pAna, toId: pAna, amountCents: 100, currency: 'ARS', date: day('01') }),
    ).rejects.toThrow('distintas')
  })
})

describe('saved filters', () => {
  test('are personal: others cannot see or delete them', async () => {
    const { ana, beto, group } = await groupWithMembers()
    const saved = await ana.savedFilters.create({ groupId: group.id, name: 'Noviembre', filters: { dateFrom: day('01') } })
    const mine = await ana.savedFilters.list({ groupId: group.id })
    expect(mine[0]!.filters.dateFrom).toBeInstanceOf(Date)
    expect(await beto.savedFilters.list({ groupId: group.id })).toEqual([])
    await expect(beto.savedFilters.delete({ savedFilterId: saved.id })).rejects.toThrow('no encontrado')
  })
})
