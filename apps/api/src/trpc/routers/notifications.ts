import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '../../db'
import { requireMembership } from '../../lib/access'
import { MAX_NOTIFICATIONS_PER_USER } from '../../lib/notifications'
import { mine, notificationSelect, toNotificationView } from '../../lib/notificationView'
import { isPushServiceUrl, isValidPushKeys, MAX_DEVICES_PER_USER, pushPublicKey } from '../../lib/push'
import { id } from '../../schemas'
import { protectedProcedure, router } from '../init'

// What the browser gives (PushSubscription.toJSON()): its push service's URL and the keys to encrypt for it.
const endpoint = z.string().max(1000)
const key = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .regex(/^[A-Za-z0-9+/_-]+={0,2}$/)
const deviceInput = z.object({
  endpoint: endpoint.refine(isPushServiceUrl, 'Este navegador no puede recibir notificaciones'),
  keys: z
    .object({ p256dh: key(80, 100), auth: key(16, 30) })
    .refine((keys) => isValidPushKeys(keys.p256dh, keys.auth), 'Este navegador no puede recibir notificaciones'),
})

export const notificationsRouter = router({
  // The caller's notifications (the bell), newest first (all they have: at most MAX_NOTIFICATIONS_PER_USER).
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id
    const notifications = await prisma.notification.findMany({
      where: mine(userId),
      select: notificationSelect(userId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_NOTIFICATIONS_PER_USER,
    })
    return notifications.map(toNotificationView)
  }),

  unreadCount: protectedProcedure.query(({ ctx }) => prisma.notification.count({ where: { ...mine(ctx.user.id), readAt: null } })),

  // The key browsers subscribe with; null = notifications on the devices are off (no VAPID keys).
  pushConfig: protectedProcedure.query(() => ({ publicKey: pushPublicKey() })),

  // Whether this browser (its endpoint) gets the caller's notifications. The browser may still have
  // a subscription the API dropped (the push service rotated it): then it's off.
  deviceStatus: protectedProcedure.input(z.object({ endpoint })).query(async ({ ctx, input }) => {
    const device = await prisma.pushSubscription.findFirst({
      where: { endpoint: input.endpoint, userId: ctx.user.id },
      select: { id: true },
    })
    return { subscribed: device !== null }
  }),

  // Turns them on in this browser. The same browser is one row: another account on it takes it over
  // (whoever turns them on last gets them). Each person keeps their latest MAX_DEVICES_PER_USER.
  subscribeDevice: protectedProcedure.input(deviceInput).mutation(async ({ ctx, input }) => {
    if (!pushPublicKey()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Las notificaciones no están disponibles por ahora.' })
    const userId = ctx.user.id
    const data = { userId, p256dh: input.keys.p256dh, auth: input.keys.auth, createdAt: new Date() }
    await prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { endpoint: input.endpoint, ...data },
      update: data,
    })
    const older = await prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: MAX_DEVICES_PER_USER,
      select: { id: true },
    })
    if (older.length > 0) await prisma.pushSubscription.deleteMany({ where: { id: { in: older.map((d) => d.id) } } })
    return { ok: true }
  }),

  // Turns them off in this browser (only if it's the caller's).
  unsubscribeDevice: protectedProcedure.input(z.object({ endpoint })).mutation(async ({ ctx, input }) => {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: input.endpoint, userId: ctx.user.id } })
    return { ok: true }
  }),

  // "Silenciar": this group's notifications don't reach the caller's devices (the app still
  // shows them). Personal: works on an archived group.
  setGroupMuted: protectedProcedure.input(z.object({ groupId: id, muted: z.boolean() })).mutation(async ({ ctx, input }) => {
    const me = await requireMembership(input.groupId, ctx.user.id)
    await prisma.participant.update({ where: { id: me.id }, data: { notificationsMuted: input.muted } })
    return { muted: input.muted }
  }),

  // Opening the notifications screen marks everything as read.
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.notification.updateMany({ where: { userId: ctx.user.id, readAt: null }, data: { readAt: new Date() } })
    return { ok: true }
  }),
})
