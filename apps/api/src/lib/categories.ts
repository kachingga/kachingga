import { TRPCError } from '@trpc/server'
import { prisma } from '../db'
import { defaultCategories } from '../schemas'

// The 8 built-in categories a new group starts with. createdAt is staggered (a few ms in the past)
// so they keep this order and any category created later comes after them.
export function defaultCategoryRows(now = new Date()) {
  const n = defaultCategories.length
  return defaultCategories.map((c, i) => ({
    name: c.name,
    icon: c.icon,
    color: c.color,
    defaultKey: c.key,
    createdAt: new Date(now.getTime() - (n - i)),
  }))
}

/**
 * The category id to store for an expense of the group. Without one → the group's "Otros" (or its
 * first active category if that one is archived). It must be the group's, and active, unless it's
 * the one the expense already had (editing an expense whose category was archived keeps it).
 */
export async function resolveExpenseCategory(groupId: string, categoryId: string | undefined, currentCategoryId?: string) {
  if (!categoryId) {
    const active = await prisma.category.findMany({
      where: { groupId, archivedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, defaultKey: true },
    })
    const fallback = active.find((c) => c.defaultKey === 'OTHER') ?? active[0]
    if (!fallback) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Elegí una categoría' })
    return fallback.id
  }
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { groupId: true, archivedAt: true } })
  if (!category || category.groupId !== groupId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Esa categoría no es del grupo' })
  }
  if (category.archivedAt && categoryId !== currentCategoryId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Esa categoría está archivada' })
  }
  return categoryId
}

const NAME_TAKEN = 'Ya hay una categoría con ese nombre'

/** Names are unique among the group's active categories, ignoring case. */
export async function assertCategoryNameFree(groupId: string, name: string, exceptId?: string) {
  const taken = await prisma.category.findFirst({
    where: { groupId, archivedAt: null, name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) },
    select: { id: true },
  })
  if (taken) throw new TRPCError({ code: 'CONFLICT', message: NAME_TAKEN })
}

/**
 * Runs a write that can repeat an active name. assertCategoryNameFree catches it first; this covers
 * two requests at the same time, which the database rejects (index "Category_active_name_key").
 */
export async function withUniqueName<T>(write: () => Promise<T>) {
  try {
    return await write()
  } catch (error) {
    if ((error as { code?: unknown }).code === 'P2002') throw new TRPCError({ code: 'CONFLICT', message: NAME_TAKEN, cause: error })
    throw error
  }
}
