import type { Prisma } from '../../db/generated/prisma/client'
import { prisma } from '../../db'
import { MAX_NOTIFICATIONS_PER_USER } from '../../lib/notifications'
import { protectedProcedure, router } from '../init'

// Only the caller's, and only of groups they're still in.
const mine = (userId: string) => ({ userId, group: { participants: { some: { userId } } } }) satisfies Prisma.NotificationWhereInput

const person = { select: { id: true, name: true } } as const

// Never `userId` (an account id) of anyone. The group comes with the caller's participant in it, to
// say "vos" in a payment.
const notificationSelect = (userId: string) =>
  ({
    id: true,
    kind: true,
    createdAt: true,
    readAt: true,
    group: { select: { id: true, name: true, participants: { where: { userId }, select: { id: true } } } },
    actor: person,
    expense: {
      select: {
        id: true,
        description: true,
        amountCents: true,
        currency: true,
        deletedAt: true,
        category: { select: { icon: true, color: true } },
      },
    },
    settlement: { select: { id: true, amountCents: true, currency: true, deletedAt: true, from: person, to: person } },
  }) satisfies Prisma.NotificationSelect

export const notificationsRouter = router({
  // The caller's "Novedades", newest first (all they have: at most MAX_NOTIFICATIONS_PER_USER).
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id
    const notifications = await prisma.notification.findMany({
      where: mine(userId),
      select: notificationSelect(userId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_NOTIFICATIONS_PER_USER,
    })
    return notifications.map(({ group: { participants, ...group }, settlement, ...n }) => {
      const me = participants[0]?.id
      return {
        ...n,
        group,
        settlement: settlement && {
          ...settlement,
          from: { ...settlement.from, isMe: settlement.from.id === me },
          to: { ...settlement.to, isMe: settlement.to.id === me },
        },
      }
    })
  }),

  unreadCount: protectedProcedure.query(({ ctx }) => prisma.notification.count({ where: { ...mine(ctx.user.id), readAt: null } })),

  // Opening "Novedades" marks everything as read.
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await prisma.notification.updateMany({ where: { userId: ctx.user.id, readAt: null }, data: { readAt: new Date() } })
    return { ok: true }
  }),
})
