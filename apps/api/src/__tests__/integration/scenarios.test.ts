// Real-life scenarios from the group, end to end through the routers.
import { describe, expect, test } from 'bun:test'
import { setupTestApi } from './setup'

const { caller } = await setupTestApi()
let n = 0

async function friends() {
  n += 1
  const yo = caller(`yo-${n}`)
  const group = await yo.groups.create({ name: 'Amigos', baseCurrency: 'ARS', myName: 'Yo' })
  for (const name of ['Tuke', 'Manu', 'Román']) await yo.participants.add({ groupId: group.id, name })
  const { participants } = await yo.groups.get({ groupId: group.id })
  const id = Object.fromEntries(participants.map((p) => [p.name, p.id])) as Record<'Yo' | 'Tuke' | 'Manu' | 'Román', string>
  const balanceOf = async (name: keyof typeof id) =>
    (await yo.balances.get({ groupId: group.id }))[0]!.balances.find((b) => b.participantId === id[name])!.amountCents
  return { yo, groupId: group.id, id, balanceOf }
}

const day = (d: string) => new Date(`2026-${d}T12:00:00Z`)
const ars = (pesos: number) => pesos * 100

describe('pagos que no son gastos', () => {
  test('le debo 100k a Tuke y le transfiero 50k a Manu: se recalcula quién le debe a quién', async () => {
    const { yo, groupId, id, balanceOf } = await friends()
    await yo.expenses.create({
      groupId,
      description: 'Entradas',
      date: day('11-01'),
      amountCents: ars(100_000),
      currency: 'ARS',
      paidById: id.Tuke,
      split: { type: 'EQUAL', participantIds: [id.Yo] },
    })
    expect(await balanceOf('Yo')).toBe(-ars(100_000))

    await yo.settlements.create({ groupId, fromId: id.Yo, toId: id.Manu, amountCents: ars(50_000), currency: 'ARS', date: day('11-02') })

    expect(await balanceOf('Yo')).toBe(-ars(50_000))
    expect(await balanceOf('Manu')).toBe(-ars(50_000)) // Manu ahora tiene plata mía
    expect(await balanceOf('Tuke')).toBe(ars(100_000))
    const transfers = (await yo.balances.get({ groupId }))[0]!.transfers
    expect(transfers).toEqual(
      expect.arrayContaining([
        { fromId: id.Yo, toId: id.Tuke, amountCents: ars(50_000) },
        { fromId: id.Manu, toId: id.Tuke, amountCents: ars(50_000) },
      ]),
    )
    // No es un gasto: no aparece en la lista ni en los totales
    expect((await yo.expenses.list({ groupId })).items).toHaveLength(1)
    expect((await yo.expenses.summary({ groupId }))[0]!.totalCents).toBe(ars(100_000))
  })

  test('marcar como pagada una transferencia sugerida deja a todos en cero', async () => {
    const { yo, groupId, id, balanceOf } = await friends()
    await yo.expenses.create({
      groupId,
      description: 'Cena',
      date: day('11-01'),
      amountCents: ars(30_000),
      currency: 'ARS',
      paidById: id.Yo,
      split: { type: 'EQUAL', participantIds: [id.Yo, id.Tuke, id.Manu] },
    })
    const transfers = (await yo.balances.get({ groupId }))[0]!.transfers
    for (const t of transfers) await yo.settlements.create({ groupId, ...t, currency: 'ARS', date: day('11-02') })
    for (const name of ['Yo', 'Tuke', 'Manu', 'Román'] as const) expect(await balanceOf(name)).toBe(0)
  })
})

describe('quién pagó y entre quiénes', () => {
  test('pagué yo pero el gasto fue solo de Román', async () => {
    const { yo, groupId, id, balanceOf } = await friends()
    await yo.expenses.create({
      groupId,
      description: 'Regalo',
      date: day('11-01'),
      amountCents: ars(20_000),
      currency: 'ARS',
      paidById: id.Yo,
      split: { type: 'EQUAL', participantIds: [id.Román] },
    })
    expect(await balanceOf('Yo')).toBe(ars(20_000))
    expect(await balanceOf('Román')).toBe(-ars(20_000))
  })

  test('cargo un gasto que pagó Román, dividido entre Tuke y yo, y después lo edito', async () => {
    const { yo, groupId, id, balanceOf } = await friends()
    const e = await yo.expenses.create({
      groupId,
      description: 'Nafta',
      date: day('11-01'),
      amountCents: ars(10_000),
      currency: 'ARS',
      paidById: id.Román,
      split: { type: 'EQUAL', participantIds: [id.Tuke, id.Yo] },
    })
    expect(await balanceOf('Román')).toBe(ars(10_000))
    expect(await balanceOf('Yo')).toBe(-ars(5_000))

    await yo.expenses.update({
      expenseId: e.id,
      description: 'Nafta',
      date: day('11-01'),
      amountCents: ars(12_000),
      currency: 'ARS',
      paidById: id.Román,
      split: {
        type: 'AMOUNT',
        shares: [
          { participantId: id.Tuke, amountCents: ars(2_000) },
          { participantId: id.Yo, amountCents: ars(10_000) },
        ],
      },
    })
    expect(await balanceOf('Yo')).toBe(-ars(10_000))
    expect(await balanceOf('Tuke')).toBe(-ars(2_000))
  })
})

describe('filtros y totales', () => {
  test('gastos en los que estoy involucrado, gastos que pagó Román, y cuánto gasté en noviembre', async () => {
    const { yo, groupId, id } = await friends()
    const add = (description: string, date: string, pesos: number, paidById: string, participantIds: string[]) =>
      yo.expenses.create({
        groupId,
        description,
        date: day(date),
        amountCents: ars(pesos),
        currency: 'ARS',
        paidById,
        split: { type: 'EQUAL', participantIds },
      })
    await add('Pagué yo, solo Román', '11-03', 1_000, id.Yo, [id.Román])
    await add('Pagó Román, entre Tuke y yo', '11-10', 4_000, id.Román, [id.Tuke, id.Yo])
    await add('Pagó Tuke, solo Manu', '11-15', 9_000, id.Tuke, [id.Manu])
    await add('Octubre, todos', '10-20', 8_000, id.Manu, [id.Yo, id.Tuke, id.Manu, id.Román])

    const names = async (filters: Parameters<typeof yo.expenses.list>[0]['filters']) =>
      (await yo.expenses.list({ groupId, filters })).items.map((e) => e.description).sort()

    expect(await names({ involvedParticipantId: id.Yo })).toEqual(['Octubre, todos', 'Pagué yo, solo Román', 'Pagó Román, entre Tuke y yo'])
    expect(await names({ paidById: id.Román })).toEqual(['Pagó Román, entre Tuke y yo'])
    const noviembre = { dateFrom: day('11-01'), dateTo: day('11-30') }
    expect(await names({ ...noviembre, involvedParticipantId: id.Yo })).toEqual(['Pagué yo, solo Román', 'Pagó Román, entre Tuke y yo'])

    const [total] = await yo.expenses.summary({ groupId, filters: noviembre })
    expect(total).toMatchObject({
      currency: 'ARS',
      count: 3,
      totalCents: ars(14_000),
      myShareCents: ars(2_000), // mi mitad de la nafta
      myPaidCents: ars(1_000), // el regalo de Román
    })
  })
})
