// Profile and group photos (root CLAUDE.md → "Fotos"), against a fake photo storage.
import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { configurePhotos, type PhotoStore } from '../../lib/photos'
import { EXIF_WITH_GPS, fakeJpegBase64 } from '../jpegFixture'
import { setupTestApi } from './setup'

const { caller, anonymous } = await setupTestApi()

// What's in the storage, and the links it signs
const stored = new Map<string, Uint8Array>()
const removed: string[] = []
const fakeStore: PhotoStore = {
  put: async (key, jpeg) => void stored.set(key, jpeg),
  remove: async (key) => void (removed.push(key), stored.delete(key)),
  sign: (key) => `https://fotos.test/${key}?firma=1`,
}
const turnOn = () => configurePhotos({}, fakeStore)
turnOn()
afterAll(() => configurePhotos({}))
beforeEach(() => {
  removed.length = 0
})

const photo = fakeJpegBase64()
const keyOf = (url: string | null) => url && new URL(url).pathname.slice(1)

let n = 0
async function scenario() {
  n += 1
  const anaId = `ana-photo-${n}`
  const ana = caller(anaId)
  const beto = caller(`beto-photo-${n}`)
  const group = await ana.groups.create({ name: 'Viaje', baseCurrency: 'ARS', myName: 'Ana' })
  await beto.groups.join({ inviteCode: group.inviteCode, name: 'Beto' })
  const juan = await ana.participants.add({ groupId: group.id, name: 'Juan' })
  return { anaId, ana, beto, groupId: group.id, juan }
}

describe('photos', () => {
  test('require login', async () => {
    await expect(anonymous.photos.config()).rejects.toThrow('UNAUTHORIZED')
    await expect(anonymous.photos.setMine({ photo })).rejects.toThrow('UNAUTHORIZED')
  })

  test('off without storage: the web hides them, and adding one says so', async () => {
    const me = caller('photos-off')
    configurePhotos({})
    try {
      expect(await me.photos.config()).toEqual({ enabled: false })
      await expect(me.photos.setMine({ photo })).rejects.toThrow('Las fotos no están disponibles por ahora.')
    } finally {
      turnOn()
    }
    expect(await me.photos.config()).toEqual({ enabled: true })
  })
})

describe('my photo', () => {
  test('stored clean (no EXIF / GPS) under a random key, and shown in every group I am in', async () => {
    const { anaId, ana, beto, groupId, juan } = await scenario()
    const { photoUrl } = await ana.photos.setMine({ photo })
    const key = keyOf(photoUrl)!
    expect(key).toMatch(/^fotos\/[0-9a-f-]{36}\.jpg$/)
    expect(key).not.toContain(anaId)
    expect(Buffer.from(stored.get(key)!).includes(Buffer.from(EXIF_WITH_GPS))).toBe(false)

    expect((await ana.profile.get()).photoUrl).toBe(photoUrl)
    // Beto sees it on my participant, in the group and in his list; Juan (no account) has none
    const people = (await beto.groups.get({ groupId })).participants
    expect(people.find((p) => p.name === 'Ana')?.photoUrl).toBe(photoUrl)
    expect(people.find((p) => p.id === juan.id)?.photoUrl).toBeNull()
    expect(people.find((p) => p.name === 'Beto')?.photoUrl).toBeNull()
    const listed = (await beto.groups.list()).find((g) => g.id === groupId)!
    expect(listed.participants.find((p) => p.name === 'Ana')?.photoUrl).toBe(photoUrl)
  })

  test('a new one replaces it (the old one is deleted), and it can be removed', async () => {
    const { ana } = await scenario()
    const first = keyOf((await ana.photos.setMine({ photo })).photoUrl)!
    const second = keyOf((await ana.photos.setMine({ photo })).photoUrl)!
    expect(second).not.toBe(first)
    expect(removed).toEqual([first])
    expect(stored.has(first)).toBe(false)

    expect(await ana.photos.removeMine()).toEqual({ photoUrl: null })
    expect(removed).toEqual([first, second])
    expect((await ana.profile.get()).photoUrl).toBeNull()
  })

  test('only an image that can be used', async () => {
    const { ana } = await scenario()
    for (const bad of ['no es base64!', Buffer.from('<svg onload=alert(1)>').toString('base64'), fakeJpegBase64({ width: 5000 })]) {
      await expect(ana.photos.setMine({ photo: bad })).rejects.toThrow('Esa imagen no se puede usar')
    }
    expect(await ana.profile.get()).toMatchObject({ photoUrl: null })
  })
})

describe('changes at the same time', () => {
  test('several uploads of the group photo at once: one wins, and the storage keeps only that one', async () => {
    const { ana, beto, groupId } = await scenario()
    stored.clear()
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => (i % 2 ? beto : ana).photos.setGroup({ groupId, photo })))
    const won = results.filter((r) => r.status === 'fulfilled')
    expect(won.length).toBeGreaterThanOrEqual(1)
    for (const r of results) if (r.status === 'rejected') expect(String(r.reason)).toContain('La foto cambió mientras tanto')
    const current = keyOf((await ana.groups.get({ groupId })).photoUrl)!
    expect([...stored.keys()]).toEqual([current])
  })

  test('the same with my own photo', async () => {
    const { ana } = await scenario()
    stored.clear()
    await Promise.allSettled(Array.from({ length: 5 }, () => ana.photos.setMine({ photo })))
    const current = keyOf((await ana.profile.get()).photoUrl)!
    expect([...stored.keys()]).toEqual([current])
  })
})

describe("the group's photo", () => {
  test('any member sets it; only members (NOT_FOUND for anyone else)', async () => {
    const { ana, beto, groupId } = await scenario()
    await expect(caller('outsider-photo').photos.setGroup({ groupId, photo })).rejects.toThrow('Grupo no encontrado')

    const { photoUrl } = await beto.photos.setGroup({ groupId, photo })
    expect((await ana.groups.get({ groupId })).photoUrl).toBe(photoUrl)
    expect((await ana.groups.list()).find((g) => g.id === groupId)?.photoUrl).toBe(photoUrl)

    // Replaced: the old one goes; removed: back to the emoji or the initial
    const old = keyOf(photoUrl)!
    await ana.photos.setGroup({ groupId, photo })
    expect(removed).toEqual([old])
    await ana.photos.removeGroup({ groupId })
    expect((await beto.groups.get({ groupId })).photoUrl).toBeNull()
  })

  test('an archived group is read-only', async () => {
    const { ana, groupId } = await scenario()
    await ana.photos.setGroup({ groupId, photo })
    await ana.groups.setArchived({ groupId, archived: true })
    await expect(ana.photos.setGroup({ groupId, photo })).rejects.toThrow('El grupo está archivado')
    await expect(ana.photos.removeGroup({ groupId })).rejects.toThrow('El grupo está archivado')
    // My own photo isn't group data
    expect((await ana.photos.setMine({ photo })).photoUrl).toStartWith('https://fotos.test/')
  })
})
