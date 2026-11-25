// Notifications on the devices (Web Push): the ones in the app (the bell) reach the phones and computers where each
// person turned them on (root CLAUDE.md → "Notificaciones"). Off without VAPID keys (local, tests,
// CI): `configurePush` is called at startup (index.ts), never in tests.
import crypto from 'node:crypto'
import webpush from 'web-push'
import { prisma } from '../db'
import { notificationPath, notificationText } from '../schemas'
import { reportError } from './monitoring'
import { mine, notificationSelect, toNotificationView } from './notificationView'

// Who sends them (the push services ask for a way to reach us if something goes wrong).
const VAPID_SUBJECT = 'mailto:hola@kachingga.com'
// A notification nobody received in a day (phone off) isn't worth showing anymore.
const PUSH_TTL_SECONDS = 24 * 60 * 60
// Devices (browsers) per person: the oldest ones go when they subscribe one more.
export const MAX_DEVICES_PER_USER = 10

// A burst of changes ("cargó 5 gastos seguidos") becomes one notification: the first waits this
// long, and after one is sent the next for the same person and group waits until a minute later.
export const PUSH_DELAY_MS = 5_000
export const PUSH_MIN_INTERVAL_MS = 60_000

// How many notifications go out at the same time (the rest wait): a change in a big group reaches
// up to 24 people with up to 10 devices each.
export const MAX_PUSHES_IN_FLIGHT = 20

/**
 * The keys a browser gives to encrypt for it: a P-256 public key (65 bytes, a point of the curve)
 * and a 16-byte secret, in base64. Anything else couldn't be used to send to it.
 */
export function isValidPushKeys(p256dh: string, auth: string): boolean {
  const key = Buffer.from(p256dh, 'base64')
  if (key.length !== 65 || key[0] !== 0x04 || Buffer.from(auth, 'base64').length !== 16) return false
  try {
    crypto.ECDH.convertKey(key, 'prime256v1')
    return true
  } catch {
    return false
  }
}

/** Whether the VAPID private key is the one of that public key (base64url, as web-push makes them). */
function isVapidPair(publicKey: string, privateKey: string) {
  try {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'))
    return ecdh.getPublicKey().equals(Buffer.from(publicKey, 'base64url'))
  } catch {
    return false
  }
}

/**
 * Only the push services of the browsers: Chrome (and Edge on Android, Samsung, Opera…), Firefox,
 * Safari and Edge on Windows. The API sends a request to the subscription's URL, so it can't be
 * any URL a client sends.
 */
export function isPushServiceUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') return false
  const host = url.hostname
  return (
    host === 'fcm.googleapis.com' ||
    host === 'updates.push.services.mozilla.com' ||
    host === 'web.push.apple.com' ||
    host.endsWith('.push.apple.com') ||
    host.endsWith('.notify.windows.com')
  )
}

type Timers = {
  now: () => number
  set: (run: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

const realTimers: Timers = {
  now: Date.now,
  // unref: a pending notification never keeps the process alive (it's lost on a restart: fine)
  set: (run, ms) => setTimeout(run, ms).unref(),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/**
 * At most one notification per person and group every PUSH_MIN_INTERVAL_MS, the first one after
 * PUSH_DELAY_MS. `send` reads what to say when it runs (the latest unread, how many there are), so
 * nothing is kept here but the timers. In memory: one API instance (like lib/rateLimit.ts).
 */
export class PushBatcher {
  private entries = new Map<string, { pending: boolean; lastSentAt: number | null; timer: unknown }>()
  private send: (userId: string, groupId: string) => Promise<void>
  private timers: Timers

  constructor(send: (userId: string, groupId: string) => Promise<void>, timers: Timers = realTimers) {
    this.send = send
    this.timers = timers
  }

  /** How many person-group pairs it's keeping (for tests). */
  get size() {
    return this.entries.size
  }

  queue(userId: string, groupId: string) {
    const key = `${userId}\n${groupId}`
    const entry = this.entries.get(key) ?? { pending: false, lastSentAt: null, timer: undefined }
    this.entries.set(key, entry)
    if (entry.pending) return
    entry.pending = true
    if (entry.timer !== undefined) this.timers.clear(entry.timer)
    const now = this.timers.now()
    const at = Math.max(now + PUSH_DELAY_MS, (entry.lastSentAt ?? -Infinity) + PUSH_MIN_INTERVAL_MS)
    entry.timer = this.timers.set(() => void this.flush(key, userId, groupId), at - now)
  }

  private async flush(key: string, userId: string, groupId: string) {
    const entry = this.entries.get(key)!
    entry.pending = false
    entry.lastSentAt = this.timers.now()
    // Forgotten once nothing can be held back anymore (unless something new was queued)
    entry.timer = this.timers.set(() => {
      if (!this.entries.get(key)?.pending) this.entries.delete(key)
    }, PUSH_MIN_INTERVAL_MS)
    try {
      await this.send(userId, groupId)
    } catch (error) {
      reportError(error, { feature: 'push' })
    }
  }
}

type Keys = { publicKey: string; privateKey: string }
type Queue = { queue: (userId: string, groupId: string) => void }
let state: { keys: Keys; batcher: Queue } | null = null

/**
 * Turns notifications on with the VAPID keys (INFRA.md), or off without them. `makeBatcher` is
 * for tests (a fake one that only records).
 */
export function configurePush(
  env: Record<string, string | undefined> = process.env,
  makeBatcher: (send: (userId: string, groupId: string) => Promise<void>) => Queue = (send) => new PushBatcher(send),
) {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) {
    state = null
    return false
  }
  // A pair that doesn't match would get every device rejected (and deleted): better off, and say so.
  if (!isVapidPair(publicKey, privateKey)) {
    state = null
    reportError(new Error('VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY no son un par: las notificaciones quedan apagadas'), { feature: 'push' })
    return false
  }
  const keys = { publicKey, privateKey }
  state = { keys, batcher: makeBatcher((userId, groupId) => sendGroupPush(userId, groupId)) }
  return true
}

// Up to MAX_PUSHES_IN_FLIGHT sends at the same time; a freed slot goes straight to the next waiting.
let inFlight = 0
const waiting: (() => void)[] = []
async function withPushSlot<T>(send: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_PUSHES_IN_FLIGHT) inFlight += 1
  else await new Promise<void>((resolve) => waiting.push(resolve))
  try {
    return await send()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else inFlight -= 1
  }
}

/** The key the browsers subscribe with; null = notifications are off. */
export const pushPublicKey = () => state?.keys.publicKey ?? null

/** A change reached these people in this group: their devices hear about it (batched). */
export function queuePushes(userIds: string[], groupId: string) {
  if (!state) return
  for (const userId of userIds) state.batcher.queue(userId, groupId)
}

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(cents / 100)

/**
 * What the device shows: the group as the title, the latest unread one ("Román agregó «Cena» ·
 * $ 45.000,00") and how many more there are in that group (then it opens the notifications screen). `badge`:
 * all the unread ones, for the app icon. `tag`: one notification per group on the device.
 */
export function pushPayload(n: ReturnType<typeof toNotificationView>, unreadInGroup: number, unreadTotal: number) {
  const item = n.expense ?? n.settlement
  const text = notificationText(n) + (item ? ` · ${money(item.amountCents, item.currency)}` : '')
  const more = unreadInGroup - 1
  return {
    title: n.group.name,
    body: more > 0 ? `${text} (y ${more} más)` : text,
    url: more > 0 ? '/notificaciones' : notificationPath(n),
    tag: n.group.id,
    badge: unreadTotal,
  }
}

/**
 * Sends one person's latest unread notification of a group to each of their devices. Nothing if
 * they have none, the group is muted for them, or they already read everything. A device that can't
 * get it is deleted: its keys don't work, or the push service doesn't know it anymore or rejects it
 * (400 / 403 / 404 / 410: unsubscribed, the browser's data cleared, made with another VAPID key).
 */
export async function sendGroupPush(userId: string, groupId: string) {
  if (!state) return
  const { keys } = state
  const devices = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
  if (devices.length === 0) return
  const me = await prisma.participant.findUnique({ where: { groupId_userId: { groupId, userId } }, select: { notificationsMuted: true } })
  if (!me || me.notificationsMuted) return
  const unread = { ...mine(userId), readAt: null }
  const latest = await prisma.notification.findFirst({
    where: { ...unread, groupId },
    select: notificationSelect(userId),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  if (!latest) return
  const [unreadInGroup, unreadTotal] = await Promise.all([
    prisma.notification.count({ where: { ...unread, groupId } }),
    prisma.notification.count({ where: unread }),
  ])
  const payload = JSON.stringify(pushPayload(toNotificationView(latest), unreadInGroup, unreadTotal))

  const forget = (id: string) => prisma.pushSubscription.deleteMany({ where: { id } })
  await Promise.all(
    devices.map((device) =>
      withPushSlot(async () => {
        let request: ReturnType<typeof webpush.generateRequestDetails>
        try {
          request = webpush.generateRequestDetails(
            { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
            payload,
            {
              vapidDetails: { subject: VAPID_SUBJECT, ...keys },
              TTL: PUSH_TTL_SECONDS,
              // An undelivered one is replaced by the next of the same group (cuid: valid as a topic)
              topic: groupId,
            },
          )
        } catch {
          await forget(device.id) // its keys can't be used
          return
        }
        const response = await fetch(request.endpoint, {
          method: request.method,
          headers: Object.fromEntries(Object.entries(request.headers).map(([name, value]) => [name, String(value)])),
          body: request.body ? new Uint8Array(request.body) : undefined,
          redirect: 'error', // only the push service itself, never wherever it points to
          signal: AbortSignal.timeout(10_000),
        }).catch(() => null) // the network or the push service down: this one is lost, like a phone off
        if (!response || response.ok) return
        if ([400, 403, 404, 410].includes(response.status)) await forget(device.id)
        else if (response.status < 500 && response.status !== 429) {
          // Our request was wrong (the payload, our VAPID key): worth knowing
          reportError(new Error(`Push rejected: ${response.status}`), { feature: 'push' })
        }
      }),
    ),
  )
}
