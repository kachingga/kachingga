import type { NotificationKind } from '../db/generated/prisma/enums'
import { prisma } from '../db'
import { reportError } from './monitoring'
import { queuePushes } from './push'

// What each user keeps in "Novedades": the latest ones, older ones are deleted. Bounds the table
// (Supabase Free: 500 MB) whatever the number of changes.
export const MAX_NOTIFICATIONS_PER_USER = 50

export type Change =
  | { kind: 'EXPENSE_CREATED' | 'EXPENSE_UPDATED' | 'EXPENSE_DELETED'; expenseId: string }
  | { kind: 'SETTLEMENT_CREATED' | 'SETTLEMENT_DELETED'; settlementId: string }

// A change replaces an unread one about the same expense or payment: added and then edited before
// they saw it is still new to them; anything else, the latest change.
export function mergedKind(unread: NotificationKind | undefined, next: NotificationKind): NotificationKind {
  return unread === 'EXPENSE_CREATED' && next === 'EXPENSE_UPDATED' ? 'EXPENSE_CREATED' : next
}

/**
 * Tells the people involved in a change (root CLAUDE.md → "Notificaciones"): the participants in
 * `involvedIds` with an account, except whoever made it (`actor`, the caller's participant).
 * A failure here never fails the change itself (it's already saved): it goes to Sentry.
 */
export async function notifyInvolved(groupId: string, actor: { id: string; userId: string }, involvedIds: string[], change: Change) {
  try {
    const recipients = await prisma.participant.findMany({
      where: { groupId, id: { in: [...new Set(involvedIds)] }, userId: { not: null } },
      select: { userId: true },
    })
    const userIds = recipients.map((r) => r.userId!).filter((userId) => userId !== actor.userId)
    if (userIds.length === 0) return

    const target = 'expenseId' in change ? { expenseId: change.expenseId } : { settlementId: change.settlementId }
    const unread = await prisma.notification.findMany({
      where: { userId: { in: userIds }, readAt: null, ...target },
      select: { id: true, userId: true, kind: true },
    })
    const unreadKind = new Map(unread.map((n) => [n.userId, n.kind]))
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { id: { in: unread.map((n) => n.id) } } }),
      prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          groupId,
          actorId: actor.id,
          kind: mergedKind(unreadKind.get(userId), change.kind),
          ...target,
        })),
      }),
      // Each of them keeps only their latest MAX_NOTIFICATIONS_PER_USER
      prisma.$executeRaw`
        DELETE FROM "Notification" WHERE "id" IN (
          SELECT "id" FROM (
            SELECT "id", row_number() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC, "id" DESC) AS "n"
            FROM "Notification" WHERE "userId" = ANY(${userIds})
          ) AS "ranked" WHERE "n" > ${MAX_NOTIFICATIONS_PER_USER}
        )`,
    ])
    queuePushes(userIds, groupId)
  } catch (error) {
    reportError(error, { feature: 'notifications' })
  }
}
