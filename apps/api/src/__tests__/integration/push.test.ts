// Notifications on the devices (lib/push.ts): subscribing a browser, muting a group, which changes
// reach whom, and what a device actually receives (decrypted like the browser does).
import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import crypto from 'node:crypto'
import ece from 'http_ece'
import webpush from 'web-push'
import { configurePush, MAX_DEVICES_PER_USER, sendGroupPush } from '../../lib/push'
import { setupTestApi } from './setup'

const { caller, anonymous, prisma } = await setupTestApi()

const vapid = webpush.generateVAPIDKeys()
const keys = { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey }
// The pushes the changes would send (the real batcher waits seconds: tested in push.test.ts)
const queued: [string, string][] = []
const turnOn = () => configurePush(keys, () => ({ queue: (userId, groupId) => void queued.push([userId, groupId]) }))
turnOn()
afterAll(() => configurePush({}))

// What the push services answer, and what they got
const received: { url: string; init: RequestInit }[] = []
let answer = (_url: string) => new Response(null, { status: 201 })
globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
  received.push({ url: String(url), init: init! })
  return answer(String(url))
}) as unknown as typeof fetch
beforeEach(() => {
  received.length = 0
  queued.length = 0
  answer = () => new Response(null, { status: 201 })
})

// A browser: its subscription and how it decrypts what arrives
let devices = 0
function browser(host = 'https://fcm.googleapis.com/fcm/send/') {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = crypto.randomBytes(16).toString('base64url')
  const subscription = { endpoint: `${host}device-${++devices}`, keys: { p256dh: ecdh.getPublicKey('base64url'), auth } }
  const read = (body: BodyInit | null | undefined) =>
    JSON.parse(ece.decrypt(Buffer.from(body as Uint8Array), { version: 'aes128gcm', privateKey: ecdh, authSecret: auth }).toString())
  return { subscription, read }
}

let n = 0
async function scenario() {
  n += 1
  const ana = caller(`ana-push-${n}`)
  const beto = caller(`beto-push-${n}`)
  const group = await ana.groups.create({ name: 'Bariloche', baseCurrency: 'ARS', myName: 'Ana' })
  await beto.groups.join({ inviteCode: group.inviteCode, name: 'Beto' })
  const ids = Object.fromEntries((await ana.groups.get({ groupId: group.id })).participants.map((p) => [p.name, p.id]))
  const cena = (description = 'Cena') =>
    ana.expenses.create({
      groupId: group.id,
      description,
      date: new Date('2026-11-20T12:00:00Z'),
      amountCents: 4_500_000,
      currency: 'ARS',
      paidById: ids.Ana!,
      split: { type: 'EQUAL', participantIds: [ids.Ana!, ids.Beto!] },
    })
  return { ana, beto, betoId: `beto-push-${n}`, group, cena }
}

describe('subscribing a device', () => {
  test('requires login', async () => {
    await expect(anonymous.notifications.pushConfig()).rejects.toThrow('UNAUTHORIZED')
    await expect(anonymous.notifications.subscribeDevice(browser().subscription)).rejects.toThrow('UNAUTHORIZED')
  })

  test('the key to subscribe with, or null when notifications on the devices are off', async () => {
    const me = caller('config-push')
    expect(await me.notifications.pushConfig()).toEqual({ publicKey: vapid.publicKey })
    configurePush({})
    try {
      expect(await me.notifications.pushConfig()).toEqual({ publicKey: null })
      await expect(me.notifications.subscribeDevice(browser().subscription)).rejects.toThrow('no están disponibles')
    } finally {
      turnOn()
    }
  })

  test('on, off, and only mine', async () => {
    const ana = caller('ana-devices')
    const eve = caller('eve-devices')
    const { subscription } = browser()
    expect(await ana.notifications.deviceStatus({ endpoint: subscription.endpoint })).toEqual({ subscribed: false })

    expect(await ana.notifications.subscribeDevice(subscription)).toEqual({ ok: true })
    expect(await ana.notifications.deviceStatus({ endpoint: subscription.endpoint })).toEqual({ subscribed: true })
    // Someone else can't see it nor turn it off
    expect(await eve.notifications.deviceStatus({ endpoint: subscription.endpoint })).toEqual({ subscribed: false })
    await eve.notifications.unsubscribeDevice({ endpoint: subscription.endpoint })
    expect(await ana.notifications.deviceStatus({ endpoint: subscription.endpoint })).toEqual({ subscribed: true })

    await ana.notifications.unsubscribeDevice({ endpoint: subscription.endpoint })
    expect(await ana.notifications.deviceStatus({ endpoint: subscription.endpoint })).toEqual({ subscribed: false })
  })

  test('the same browser is one device: another account that turns them on there takes it over', async () => {
    const ana = caller('ana-shared')
    const beto = caller('beto-shared')
    const { subscription } = browser()
    await ana.notifications.subscribeDevice(subscription)
    await beto.notifications.subscribeDevice(subscription)
    expect(await ana.notifications.deviceStatus({ endpoint: subscription.endpoint })).toEqual({ subscribed: false })
    expect(await beto.notifications.deviceStatus({ endpoint: subscription.endpoint })).toEqual({ subscribed: true })
    expect(await prisma.pushSubscription.count({ where: { endpoint: subscription.endpoint } })).toBe(1)
  })

  test('only the browsers push services, and valid keys', async () => {
    const me = caller('picky-push')
    const { subscription } = browser()
    for (const endpoint of [
      'https://169.254.169.254/latest',
      'http://fcm.googleapis.com/fcm/send/x',
      'https://evil.example/fcm.googleapis.com',
    ]) {
      await expect(me.notifications.subscribeDevice({ ...subscription, endpoint })).rejects.toThrow(
        'Este navegador no puede recibir notificaciones',
      )
    }
    await expect(me.notifications.subscribeDevice({ ...subscription, keys: { ...subscription.keys, p256dh: 'corta' } })).rejects.toThrow()
    await expect(
      me.notifications.subscribeDevice({ ...subscription, keys: { ...subscription.keys, auth: 'no<base64>!!!!!!!' } }),
    ).rejects.toThrow()
    await expect(
      me.notifications.subscribeDevice({ ...subscription, endpoint: `${subscription.endpoint}${'x'.repeat(1000)}` }),
    ).rejects.toThrow()
    // Firefox, Safari and Edge
    for (const host of [
      'https://updates.push.services.mozilla.com/wpush/v2/',
      'https://web.push.apple.com/',
      'https://wns2-bl2p.notify.windows.com/w/?token=',
    ]) {
      expect(await me.notifications.subscribeDevice(browser(host).subscription)).toEqual({ ok: true })
    }
  })

  test(`each person keeps their latest ${MAX_DEVICES_PER_USER} devices`, async () => {
    const me = caller('many-devices')
    const all = Array.from({ length: MAX_DEVICES_PER_USER + 2 }, () => browser().subscription)
    for (const subscription of all) await me.notifications.subscribeDevice(subscription)
    expect(await prisma.pushSubscription.count({ where: { userId: 'many-devices' } })).toBe(MAX_DEVICES_PER_USER)
    expect(await me.notifications.deviceStatus({ endpoint: all[0]!.endpoint })).toEqual({ subscribed: false })
    expect(await me.notifications.deviceStatus({ endpoint: all.at(-1)!.endpoint })).toEqual({ subscribed: true })
  })
})

describe('muting a group', () => {
  test('only members (NOT_FOUND for anyone else), mine, and it works on an archived group', async () => {
    const { ana, beto, group } = await scenario()
    await expect(caller('outsider-mute').notifications.setGroupMuted({ groupId: group.id, muted: true })).rejects.toThrow(
      'Grupo no encontrado',
    )

    expect((await beto.groups.get({ groupId: group.id })).notificationsMuted).toBe(false)
    expect(await beto.notifications.setGroupMuted({ groupId: group.id, muted: true })).toEqual({ muted: true })
    expect((await beto.groups.get({ groupId: group.id })).notificationsMuted).toBe(true)
    // Ana's isn't touched
    expect((await ana.groups.get({ groupId: group.id })).notificationsMuted).toBe(false)

    await ana.groups.setArchived({ groupId: group.id, archived: true })
    expect(await beto.notifications.setGroupMuted({ groupId: group.id, muted: false })).toEqual({ muted: false })
  })
})

describe('what reaches the devices', () => {
  test('a change queues a notification for the people it reached (not for who made it)', async () => {
    const { betoId, group, cena } = await scenario()
    await cena()
    expect(queued).toEqual([[betoId, group.id]])
  })

  test('the device receives the latest unread one, encrypted for it, and how many more there are', async () => {
    const { beto, betoId, group, cena } = await scenario()
    const phone = browser()
    const laptop = browser('https://web.push.apple.com/')
    await beto.notifications.subscribeDevice(phone.subscription)
    await beto.notifications.subscribeDevice(laptop.subscription)
    await cena('Asado')
    const latest = await cena('Cena')

    await sendGroupPush(betoId, group.id)
    expect(received.map((r) => r.url).sort()).toEqual([laptop.subscription.endpoint, phone.subscription.endpoint].sort())
    const toPhone = received.find((r) => r.url === phone.subscription.endpoint)!
    expect(toPhone.init.method).toBe('POST')
    expect(toPhone.init.headers).toMatchObject({
      TTL: '86400',
      Topic: group.id,
      'Content-Encoding': 'aes128gcm',
      Authorization: expect.stringMatching(/^vapid t=.+, k=/),
    })
    expect(phone.read(toPhone.init.body)).toEqual({
      title: 'Bariloche',
      body: expect.stringMatching(/^Ana agregó «Cena» · \$\s45\.000,00 \(y 1 más\)$/),
      url: '/novedades',
      tag: group.id,
      badge: 2,
    })
    expect(latest.description).toBe('Cena')

    // Just one unread: straight to the expense
    await beto.notifications.markAllRead()
    const solo = await cena('Postre')
    received.length = 0
    await sendGroupPush(betoId, group.id)
    expect(phone.read(received.find((r) => r.url === phone.subscription.endpoint)!.init.body)).toMatchObject({
      body: expect.stringMatching(/^Ana agregó «Postre»/),
      url: `/grupos/${group.id}/gastos/${solo.id}`,
      badge: 1,
    })
  })

  test('nothing if they already read it, or muted the group', async () => {
    const { beto, betoId, group, cena } = await scenario()
    await beto.notifications.subscribeDevice(browser().subscription)
    await cena()
    await beto.notifications.markAllRead()
    await sendGroupPush(betoId, group.id)
    expect(received).toEqual([])

    await cena('Otra')
    await beto.notifications.setGroupMuted({ groupId: group.id, muted: true })
    await sendGroupPush(betoId, group.id)
    expect(received).toEqual([])
    // Still in "Novedades"
    expect(await beto.notifications.unreadCount()).toBe(1)
  })

  test('a device the push service no longer knows (404 / 410) is deleted; other errors keep it', async () => {
    const { beto, betoId, group, cena } = await scenario()
    const gone = browser()
    const notFound = browser()
    const flaky = browser()
    for (const device of [gone, notFound, flaky]) await beto.notifications.subscribeDevice(device.subscription)
    answer = (url) =>
      new Response(null, { status: url === gone.subscription.endpoint ? 410 : url === notFound.subscription.endpoint ? 404 : 503 })
    await cena()
    await sendGroupPush(betoId, group.id)

    const left = await prisma.pushSubscription.findMany({ where: { userId: betoId }, select: { endpoint: true } })
    expect(left.map((d) => d.endpoint)).toEqual([flaky.subscription.endpoint])
  })

  test('with notifications off, nothing is sent', async () => {
    const { beto, betoId, group, cena } = await scenario()
    await beto.notifications.subscribeDevice(browser().subscription)
    await cena()
    configurePush({})
    try {
      await cena('Otra')
      await sendGroupPush(betoId, group.id)
      expect(received).toEqual([])
      expect(queued).toEqual([[betoId, group.id]]) // only the one from before turning it off
    } finally {
      turnOn()
    }
  })
})
