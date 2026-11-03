import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '../../db'
import { requireMembership } from '../../lib/access'
import { expenseFilters } from '../../schemas'
import { protectedProcedure, router } from '../init'

export const savedFiltersRouter = router({
  list: protectedProcedure.input(z.object({ groupId: z.string() })).query(async ({ ctx, input }) => {
    await requireMembership(input.groupId, ctx.user.id)
    const saved = await prisma.savedFilter.findMany({
      where: { groupId: input.groupId, userId: ctx.user.id },
      orderBy: { createdAt: 'asc' },
    })
    // Stored as JSON: re-parse so dates come back as Date and old shapes don't break the app.
    return saved.map((f) => ({ id: f.id, name: f.name, filters: expenseFilters.catch({}).parse(revive(f.filters)) }))
  }),

  create: protectedProcedure
    .input(z.object({ groupId: z.string(), name: z.string().trim().min(1).max(40), filters: expenseFilters }))
    .mutation(async ({ ctx, input }) => {
      await requireMembership(input.groupId, ctx.user.id)
      return prisma.savedFilter.create({
        data: { groupId: input.groupId, userId: ctx.user.id, name: input.name, filters: input.filters },
      })
    }),

  delete: protectedProcedure.input(z.object({ savedFilterId: z.string() })).mutation(async ({ ctx, input }) => {
    const { count } = await prisma.savedFilter.deleteMany({ where: { id: input.savedFilterId, userId: ctx.user.id } })
    if (count === 0) throw new TRPCError({ code: 'NOT_FOUND', message: 'Filtro no encontrado' })
    return { ok: true }
  }),
})

function revive(json: unknown) {
  const filters = { ...(json as Record<string, unknown>) }
  for (const key of ['dateFrom', 'dateTo'] as const) {
    if (typeof filters[key] === 'string') filters[key] = new Date(filters[key])
  }
  return filters
}
