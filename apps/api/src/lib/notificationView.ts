import type { Prisma } from '../db/generated/prisma/client'

// How a notification is read, in the app (routers/notifications.ts) and the devices (lib/push.ts).

// Only the user's, and only of groups they're still in.
export const mine = (userId: string) => ({ userId, group: { participants: { some: { userId } } } }) satisfies Prisma.NotificationWhereInput

const person = { select: { id: true, name: true } } as const

// What a notification shows. Never `userId` (an account id) of anyone. The group comes with the
// user's participant in it, to say "vos" in a payment (toNotificationView).
export const notificationSelect = (userId: string) =>
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

type NotificationRow = Prisma.NotificationGetPayload<{ select: ReturnType<typeof notificationSelect> }>

/** A notification as `notifications.list` returns it: `isMe` on each side of a payment. */
export function toNotificationView({ group: { participants, ...group }, settlement, ...n }: NotificationRow) {
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
}
