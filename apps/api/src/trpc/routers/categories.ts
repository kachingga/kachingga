import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '../../db'
import { requireActiveGroup, requireMembership } from '../../lib/access'
import { assertCategoryNameFree } from '../../lib/categories'
import { categoryInput } from '../../schemas'
import { protectedProcedure, router } from '../init'

const categoryId = z.object({ categoryId: z.string() })

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
  list: protectedProcedure.input(z.object({ groupId: z.string() })).query(async ({ ctx, input }) => {
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

  create: protectedProcedure.input(categoryInput.extend({ groupId: z.string() })).mutation(async ({ ctx, input }) => {
    await requireActiveGroup(input.groupId, ctx.user.id)
    await assertCategoryNameFree(input.groupId, input.name)
    return prisma.category.create({ data: { groupId: input.groupId, name: input.name, icon: input.icon, color: input.color } })
  }),

  update: protectedProcedure.input(categoryInput.partial().merge(categoryId)).mutation(async ({ ctx, input }) => {
    const category = await findCategoryToChange(input.categoryId, ctx.user.id)
    if (input.name !== undefined && !category.archivedAt) await assertCategoryNameFree(category.groupId, input.name, category.id)
    return prisma.category.update({
      where: { id: category.id },
      data: { name: input.name, icon: input.icon, color: input.color },
    })
  }),

  archive: protectedProcedure.input(categoryId).mutation(async ({ ctx, input }) => {
    const category = await findCategoryToChange(input.categoryId, ctx.user.id)
    if (category.archivedAt) return category
    const othersActive = await prisma.category.count({ where: { groupId: category.groupId, archivedAt: null, id: { not: category.id } } })
    if (othersActive === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'El grupo necesita al menos una categoría' })
    return prisma.category.update({ where: { id: category.id }, data: { archivedAt: new Date() } })
  }),

  unarchive: protectedProcedure.input(categoryId).mutation(async ({ ctx, input }) => {
    const category = await findCategoryToChange(input.categoryId, ctx.user.id)
    if (!category.archivedAt) return category
    await assertCategoryNameFree(category.groupId, category.name, category.id)
    return prisma.category.update({ where: { id: category.id }, data: { archivedAt: null } })
  }),
})
