import { TRPCError } from '@trpc/server'
import { prisma } from '../db'

// Quotas (root CLAUDE.md): generous for a group of friends, they stop a single account from filling
// the database (Supabase Free: 500 MB for prod and staging together, then the app stops working for
// everyone: INFRA.md → "Plan de Supabase"). Counted before creating, so requests at the very same
// time can go a few over (one per concurrent request, bounded by the per-user limits in
// lib/rateLimit.ts): harmless.
export const MAX_GROUPS_CREATED_PER_USER = 50
export const MAX_PARTICIPANTS_PER_GROUP = 50
// Archived ones count too (they're never deleted)
export const MAX_CATEGORIES_PER_GROUP = 50
export const MAX_SAVED_FILTERS_PER_GROUP = 30
// Deleted ones count too (soft delete: they still take up space)
export const MAX_EXPENSES_PER_GROUP = 5000
export const MAX_SETTLEMENTS_PER_GROUP = 5000

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

export async function assertRoomForExpense(groupId: string) {
  const count = await prisma.expense.count({ where: { groupId } })
  assertBelow(
    count,
    MAX_EXPENSES_PER_GROUP,
    `Un grupo puede tener hasta ${MAX_EXPENSES_PER_GROUP.toLocaleString('es-AR')} gastos, contando los borrados.`,
  )
}

export async function assertRoomForSettlement(groupId: string) {
  const count = await prisma.settlement.count({ where: { groupId } })
  assertBelow(
    count,
    MAX_SETTLEMENTS_PER_GROUP,
    `Un grupo puede tener hasta ${MAX_SETTLEMENTS_PER_GROUP.toLocaleString('es-AR')} pagos, contando los borrados.`,
  )
}
