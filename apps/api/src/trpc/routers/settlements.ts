import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Prisma } from '../../db/generated/prisma/client'
import { prisma } from '../../db'
import { assertParticipantsInGroup, requireActiveGroup, requireMembership } from '../../lib/access'
import { assertRoomForSettlement } from '../../lib/quotas'
import { resolveExchangeRate } from '../../lib/rates'
import { id, settlementInput } from '../../schemas'
import { protectedProcedure, router } from '../init'

// What `list` and `create` return for each payment. Never `createdById`: another member's account id.
const settlementSelect = {
  id: true,
  groupId: true,
  fromId: true,
  toId: true,
  amountCents: true,
  currency: true,
  exchangeRate: true,
  date: true,
  note: true,
  createdAt: true,
  deletedAt: true,
  from: { select: { id: true, name: true } },
  to: { select: { id: true, name: true } },
} satisfies Prisma.SettlementSelect

export const settlementsRouter = router({
  list: protectedProcedure.input(z.object({ groupId: id })).query(async ({ ctx, input }) => {
    await requireMembership(input.groupId, ctx.user.id)
    return prisma.settlement.findMany({
      where: { groupId: input.groupId, deletedAt: null },
      select: settlementSelect,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })
  }),

  // Manual "I paid you back" (the payment happened outside the app).
  create: protectedProcedure.input(settlementInput).mutation(async ({ ctx, input }) => {
    const { group } = await requireActiveGroup(input.groupId, ctx.user.id)
    await assertRoomForSettlement(input.groupId)
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
      select: settlementSelect,
    })
  }),

  delete: protectedProcedure.input(z.object({ settlementId: id })).mutation(async ({ ctx, input }) => {
    const settlement = await prisma.settlement.findUnique({ where: { id: input.settlementId } })
    if (!settlement || settlement.deletedAt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Pago no encontrado' })
    await requireActiveGroup(settlement.groupId, ctx.user.id)
    await prisma.settlement.update({ where: { id: settlement.id }, data: { deletedAt: new Date() } })
    return { ok: true }
  }),
})
