// Alias/CVU para cobrar: de la cuenta (todos los grupos) o propio de un grupo.
import { describe, expect, test } from 'bun:test'
import { paymentAlias } from '../../schemas'
import { setupTestApi } from './setup'

const { caller, anonymous } = await setupTestApi()
let n = 0

async function group() {
  n += 1
  const yo = caller(`yo-${n}`)
  const tuke = caller(`tuke-${n}`)
  const g = await yo.groups.create({ name: 'Amigos', baseCurrency: 'ARS', myName: 'Yo' })
  await tuke.groups.join({ inviteCode: g.inviteCode, name: 'Tuke' })
  const juan = await yo.participants.add({ groupId: g.id, name: 'Juan' })
  const aliasOf = async (name: string) => (await yo.groups.get({ groupId: g.id })).participants.find((p) => p.name === name)!
  const idOf = async (name: string) => (await aliasOf(name)).id
  return { yo, tuke, groupId: g.id, juanId: juan.id, aliasOf, idOf }
}

describe('alias de la cuenta', () => {
  test('requires login', async () => {
    await expect(anonymous.profile.get()).rejects.toThrow('UNAUTHORIZED')
  })

  test('starts empty, can be set and cleared', async () => {
    const { yo } = await group()
    expect(await yo.profile.get()).toEqual({ paymentAlias: null })
    await yo.profile.update({ paymentAlias: 'galo.mp' })
    expect(await yo.profile.get()).toEqual({ paymentAlias: 'galo.mp' })
    await yo.profile.update({ paymentAlias: null })
    expect(await yo.profile.get()).toEqual({ paymentAlias: null })
  })

  test('shows up in every group of that person', async () => {
    const { tuke, aliasOf } = await group()
    await tuke.profile.update({ paymentAlias: 'tuke.mp' })
    expect(await aliasOf('Tuke')).toMatchObject({ paymentAlias: 'tuke.mp', paymentAliasSource: 'account' })

    const otro = await tuke.groups.create({ name: 'Depto', baseCurrency: 'ARS', myName: 'Tuke' })
    const enOtro = (await tuke.groups.get({ groupId: otro.id })).participants.find((p) => p.isMe)!
    expect(enOtro).toMatchObject({ paymentAlias: 'tuke.mp', paymentAliasSource: 'account' })
  })
})

describe('alias por grupo', () => {
  test('overrides the account alias only in that group; null goes back to the account one', async () => {
    const { yo, groupId, aliasOf, idOf } = await group()
    await yo.profile.update({ paymentAlias: 'galo.mp' })
    const me = await idOf('Yo')

    await yo.participants.setPaymentAlias({ participantId: me, paymentAlias: 'galo.viajes' })
    expect(await aliasOf('Yo')).toMatchObject({ paymentAlias: 'galo.viajes', paymentAliasSource: 'group' })
    expect(await yo.profile.get()).toEqual({ paymentAlias: 'galo.mp' }) // la cuenta no cambia

    await yo.participants.setPaymentAlias({ participantId: me, paymentAlias: null })
    expect(await aliasOf('Yo')).toMatchObject({ paymentAlias: 'galo.mp', paymentAliasSource: 'account' })
    void groupId
  })

  test('nobody can change the alias of someone else with account', async () => {
    const { yo, idOf } = await group()
    await expect(yo.participants.setPaymentAlias({ participantId: await idOf('Tuke'), paymentAlias: 'robo.mp' })).rejects.toThrow(
      'Solo Tuke puede cambiar su alias',
    )
  })

  test('anyone in the group can set it for someone without account', async () => {
    const { tuke, juanId, aliasOf } = await group()
    expect(await aliasOf('Juan')).toMatchObject({ paymentAlias: null, paymentAliasSource: null })
    await tuke.participants.setPaymentAlias({ participantId: juanId, paymentAlias: 'juan.perez' })
    expect(await aliasOf('Juan')).toMatchObject({ paymentAlias: 'juan.perez', paymentAliasSource: 'group' })
  })

  test('outsiders cannot touch a group alias', async () => {
    const { juanId } = await group()
    await expect(caller(`intruso-${n}`).participants.setPaymentAlias({ participantId: juanId, paymentAlias: 'robo.mp' })).rejects.toThrow(
      'Grupo no encontrado',
    )
  })

  test('archived group: read-only', async () => {
    const { yo, groupId, idOf } = await group()
    const me = await idOf('Yo')
    await yo.groups.setArchived({ groupId, archived: true })
    await expect(yo.participants.setPaymentAlias({ participantId: me, paymentAlias: 'galo.mp' })).rejects.toThrow('archivado')
  })
})

describe('formato', () => {
  test.each(['galo.mp', 'tuke-pagos', 'abc123', '0000003100010000000001'])('accepts %p', (value) => {
    expect(paymentAlias.parse(value)).toBe(value)
  })

  test.each(['abc', 'con espacios', 'demasiado.largo.para.alias', '123', 'ñandu.mp'])('rejects %p', (value) => {
    expect(() => paymentAlias.parse(value)).toThrow('Alias (6 a 20')
  })

  test('trims spaces and accepts null', () => {
    expect(paymentAlias.parse('  galo.mp ')).toBe('galo.mp')
    expect(paymentAlias.parse(null)).toBeNull()
  })
})
