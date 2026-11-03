import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '../../db'
import { assertParticipantsInGroup, requireActiveGroup, requireMembership } from '../../lib/access'
import { resolveExchangeRate } from '../../lib/rates'
import { settlementInput } from '../../schemas'
import { protectedProcedure, router } from '../init'

const people = { from: { select: { id: true, name: true } }, to: { select: { id: true, name: true } } }

export const settlementsRouter = router({
  list: protectedProcedure.input(z.object({ groupId: z.string() })).query(async ({ ctx, input }) => {
    await requireMembership(input.groupId, ctx.user.id)
    return prisma.settlement.findMany({
      where: { groupId: input.groupId, deletedAt: null },
      include: people,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
  }),

  // Manual "I paid you back" (the payment happened outside the app).
  create: protectedProcedure.input(settlementInput).mutation(async ({ ctx, input }) => {
    const { group } = await requireActiveGroup(input.groupId, ctx.user.id)
    if (input.fromId === input.toId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tiene que ser entre dos personas distintas' })
    await assertParticipantsInGroup(input.groupId, [input.fromId, input.toId])
    const exchangeRate = await resolveExchangeRate({ ...input, baseCurrency: group.baseCurrency })
    return prisma.settlement.create({
      data: {
        groupId: input.groupId,
        fromId: input.fromId,
        toId: input.toId,
        amountCents: input.amountCents,
        currency: input.currency,
        exchangeRate,
        date: input.date,
        note: input.note ?? null,
        createdById: ctx.user.id,
      },
      include: people,
    })
  }),

  delete: protectedProcedure.input(z.object({ settlementId: z.string() })).mutation(async ({ ctx, input }) => {
    const settlement = await prisma.settlement.findUnique({ where: { id: input.settlementId } })
    if (!settlement || settlement.deletedAt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pago no encontrado' })
    await requireActiveGroup(settlement.groupId, ctx.user.id)
    await prisma.settlement.update({ where: { id: settlement.id }, data: { deletedAt: new Date() } })
    return { ok: true }
  }),
})
