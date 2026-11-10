import { TRPCError } from '@trpc/server'
import { prisma } from '../db'

// Quotas (root CLAUDE.md): generous for a group of friends, they stop a single account from filling
// the database (Supabase Free: 500 MB, then read-only for everyone). Counted before creating, so two
// requests at the very same time can go one over: harmless.
export const MAX_GROUPS_CREATED_PER_USER = 50
export const MAX_PARTICIPANTS_PER_GROUP = 50
// Archived ones count too (they're never deleted)
export const MAX_CATEGORIES_PER_GROUP = 50
export const MAX_SAVED_FILTERS_PER_GROUP = 30

function assertBelow(count: number, max: number, message: string) {
  if (count >= max) throw new TRPCError({ code: 'BAD_REQUEST', message })
}

export async function assertCanCreateGroup(userId: string) {
  const count = await prisma.group.count({ where: { createdById: userId } })
  assertBelow(count, MAX_GROUPS_CREATED_PER_USER, `Podés crear hasta ${MAX_GROUPS_CREATED_PER_USER} grupos.`)
}

export async function assertRoomForParticipant(groupId: string) {
  const count = await prisma.participant.count({ where: { groupId } })
  assertBelow(count, MAX_PARTICIPANTS_PER_GROUP, `Un grupo puede tener hasta ${MAX_PARTICIPANTS_PER_GROUP} personas.`)
}

export async function assertRoomForCategory(groupId: string) {
  const count = await prisma.category.count({ where: { groupId } })
  assertBelow(
    count,
    MAX_CATEGORIES_PER_GROUP,
    `Un grupo puede tener hasta ${MAX_CATEGORIES_PER_GROUP} categorías, contando las archivadas.`,
  )
}

export async function assertRoomForSavedFilter(groupId: string, userId: string) {
  const count = await prisma.savedFilter.count({ where: { groupId, userId } })
  assertBelow(count, MAX_SAVED_FILTERS_PER_GROUP, `Podés guardar hasta ${MAX_SAVED_FILTERS_PER_GROUP} filtros por grupo.`)
}
