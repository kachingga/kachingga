// A group's emoji (root CLAUDE.md → "Grupos"): any member sets it, one emoji, read-only when archived.
import { describe, expect, test } from 'bun:test'
import { isSingleEmoji } from '../../schemas'
import { setupTestApi } from './setup'

const { caller, anonymous } = await setupTestApi()

describe('isSingleEmoji', () => {
  test.each(['✈️', '🏖️', '🍕', '🇦🇷', '👍🏽', '👨‍👩‍👧', '❤️'])('one emoji: %s', (emoji) => {
    expect(isSingleEmoji(emoji)).toBe(true)
  })
  test.each(['', 'a', 'AB', '12', '🍕🍕', '🍕 ', 'hola 🍕', '<script>'])('anything else: %p', (value) => {
    expect(isSingleEmoji(value)).toBe(false)
  })

  test('something long is rejected right away, without going through it', () => {
    const huge = '🍕'.repeat(500_000)
    const start = performance.now()
    expect(isSingleEmoji(huge)).toBe(false)
    expect(performance.now() - start).toBeLessThan(5)
  })
})

let n = 0
async function group() {
  n += 1
  const ana = caller(`ana-emoji-${n}`)
  const beto = caller(`beto-emoji-${n}`)
  const created = await ana.groups.create({ name: 'Viaje', baseCurrency: 'ARS', myName: 'Ana' })
  await beto.groups.join({ inviteCode: created.inviteCode, name: 'Beto' })
  return { ana, beto, groupId: created.id }
}

describe('groups.setEmoji', () => {
  test('requires login, and only members (NOT_FOUND for anyone else)', async () => {
    const { groupId } = await group()
    await expect(anonymous.groups.setEmoji({ groupId, emoji: '🍕' })).rejects.toThrow('UNAUTHORIZED')
    await expect(caller('outsider-emoji').groups.setEmoji({ groupId, emoji: '🍕' })).rejects.toThrow('Grupo no encontrado')
  })

  test('any member sets it, everyone sees it (in the group and in their list), and it can go back to the initial', async () => {
    const { ana, beto, groupId } = await group()
    expect(await beto.groups.setEmoji({ groupId, emoji: ' 🏖️ ' })).toMatchObject({ id: groupId, emoji: '🏖️' })
    expect((await ana.groups.get({ groupId })).emoji).toBe('🏖️')
    expect((await ana.groups.list()).find((g) => g.id === groupId)?.emoji).toBe('🏖️')

    await ana.groups.setEmoji({ groupId, emoji: null })
    expect((await beto.groups.get({ groupId })).emoji).toBeNull()
  })

  test('only one emoji', async () => {
    const { ana, groupId } = await group()
    for (const emoji of ['A', '🍕🍕', 'hola', '']) {
      await expect(ana.groups.setEmoji({ groupId, emoji })).rejects.toThrow('Elegí un solo emoji')
    }
  })

  test('a new group has none', async () => {
    const { ana, groupId } = await group()
    expect((await ana.groups.get({ groupId })).emoji).toBeNull()
  })
})
