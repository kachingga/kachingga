import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Prisma } from '../../db/generated/prisma/client'
import { prisma } from '../../db'
import { requireActiveGroup, requireMembership } from '../../lib/access'
import { assertCategoryNameFree, withUniqueName } from '../../lib/categories'
import { equivalentCategory, suggestDefaultKey, suggestFromHistory } from '../../lib/categorySuggestion'
import { assertRoomForCategory } from '../../lib/quotas'
import { categoryInput, categorySuggestionInput, id } from '../../schemas'
import { protectedProcedure, router } from '../init'

const categoryId = z.object({ categoryId: id })

// How many of the group's latest expenses the suggestion compares against.
const SUGGESTION_HISTORY = 500

// A category to change: the caller has to be a member of its group, and the group active
// (never trust a groupId from the input for something that already exists).
async function findCategoryToChange(id: string, userId: string) {
  const category = await prisma.category.findUnique({ where: { id } })
  if (!category) throw new TRPCError({ code: 'NOT_FOUND', message: 'Categoría no encontrada' })
  await requireActiveGroup(category.groupId, userId)
  return category
}

// Categories belong to each group and any member can manage them (no admin). Archived = kept on
// its expenses but can't be picked for new ones; they're never deleted.
export const categoriesRouter = router({
  // All of the group's categories in order, archived ones included (`archived`), with how many
  // (active) expenses use each one.
  list: protectedProcedure.input(z.object({ groupId: id })).query(async ({ ctx, input }) => {
    await requireMembership(input.groupId, ctx.user.id)
    const categories = await prisma.category.findMany({
      where: { groupId: input.groupId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { expenses: { where: { deletedAt: null } } } } },
    })
    return categories.map(({ _count, archivedAt, ...c }) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      defaultKey: c.defaultKey,
      archived: archivedAt !== null,
      expenseCount: _count.expenses,
    }))
  }),

  // Automatic category for a new expense from its description (the form asks while typing): the
  // category of a similar past expense of the group, else the built-in one its keywords point to,
  // else null. Only active categories of the group are ever suggested. Logic: lib/categorySuggestion.
  suggest: protectedProcedure.input(categorySuggestionInput).query(async ({ ctx, input }) => {
    await requireMembership(input.groupId, ctx.user.id)
    // What someone chose: an active category that isn't "Otros" (where an expense ends up if nobody picks one)
    const chosen = { archivedAt: null, OR: [{ defaultKey: null }, { defaultKey: { not: 'OTHER' } }] } satisfies Prisma.CategoryWhereInput
    const newestFirst = [{ date: 'desc' as const }, { createdAt: 'desc' as const }]
    const history = await prisma.expense.findMany({
      where: { groupId: input.groupId, deletedAt: null, category: chosen },
      orderBy: newestFirst,
      take: SUGGESTION_HISTORY,
      select: { description: true, categoryId: true },
    })
    const fromHistory = suggestFromHistory(input.description, history)
    if (fromHistory) return { categoryId: fromHistory, source: 'history' as const }

    // What the caller decided in their other groups (only theirs), in this group's equivalent category
    const elsewhere = await prisma.expense.findMany({
      where: {
        groupId: { not: input.groupId },
        group: { participants: { some: { userId: ctx.user.id } } },
        deletedAt: null,
        category: chosen,
      },
      orderBy: newestFirst,
      take: SUGGESTION_HISTORY,
      select: { description: true, categoryId: true, category: { select: { name: true, defaultKey: true } } },
    })
    const fromElsewhere = suggestFromHistory(input.description, elsewhere)
    if (fromElsewhere) {
      const candidates = await prisma.category.findMany({
        where: { groupId: input.groupId, archivedAt: null },
        select: { id: true, name: true, defaultKey: true },
      })
      const equivalent = equivalentCategory(elsewhere.find((e) => e.categoryId === fromElsewhere)!.category, candidates)
      if (equivalent) return { categoryId: equivalent, source: 'yourGroups' as const }
    }

    const defaultKey = suggestDefaultKey(input.description)
    if (!defaultKey) return null
    const category = await prisma.category.findFirst({
      where: { groupId: input.groupId, defaultKey, archivedAt: null },
      select: { id: true },
    })
    return category && { categoryId: category.id, source: 'keyword' as const }
  }),

  create: protectedProcedure.input(categoryInput.extend({ groupId: id })).mutation(async ({ ctx, input }) => {
    await requireActiveGroup(input.groupId, ctx.user.id)
    await assertRoomForCategory(input.groupId)
    await assertCategoryNameFree(input.groupId, input.name)
    return withUniqueName(() =>
      prisma.category.create({ data: { groupId: input.groupId, name: input.name, icon: input.icon, color: input.color } }),
    )
  }),

  update: protectedProcedure.input(categoryInput.partial().merge(categoryId)).mutation(async ({ ctx, input }) => {
    const category = await findCategoryToChange(input.categoryId, ctx.user.id)
    if (input.name !== undefined && !category.archivedAt) await assertCategoryNameFree(category.groupId, input.name, category.id)
    return withUniqueName(() =>
      prisma.category.update({
        where: { id: category.id },
        data: { name: input.name, icon: input.icon, color: input.color },
      }),
    )
  }),

  archive: protectedProcedure.input(categoryId).mutation(async ({ ctx, input }) => {
    const category = await findCategoryToChange(input.categoryId, ctx.user.id)
    if (category.archivedAt) return category
    return prisma.$transaction(async (tx) => {
      // Locks the group's active categories until commit: two archives at the same time can't each
      // see the other one still active and leave the group without any.
      const active = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Category" WHERE "groupId" = ${category.groupId} AND "archivedAt" IS NULL ORDER BY "id" FOR UPDATE`
      if (!active.some((c) => c.id !== category.id)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'El grupo necesita al menos una categoría' })
      }
      return tx.category.update({ where: { id: category.id }, data: { archivedAt: new Date() } })
    })
  }),

  unarchive: protectedProcedure.input(categoryId).mutation(async ({ ctx, input }) => {
    const category = await findCategoryToChange(input.categoryId, ctx.user.id)
    if (!category.archivedAt) return category
    await assertCategoryNameFree(category.groupId, category.name, category.id)
    return withUniqueName(() => prisma.category.update({ where: { id: category.id }, data: { archivedAt: null } }))
  }),
})
