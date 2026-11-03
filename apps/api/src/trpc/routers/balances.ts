import { z } from 'zod'
import { prisma } from '../../db'
import { requireMembership } from '../../lib/access'
import { computeBalances } from '../../lib/balances'
import { protectedProcedure, router } from '../init'

export const balancesRouter = router({
  // One entry per currency (base first): balance per participant + suggested minimal transfers.
  get: protectedProcedure.input(z.object({ groupId: z.string() })).query(async ({ ctx, input }) => {
    const { group } = await requireMembership(input.groupId, ctx.user.id)
    const [participants, expenses, settlements] = await Promise.all([
      prisma.participant.findMany({ where: { groupId: group.id }, select: { id: true } }),
      prisma.expense.findMany({
        where: { groupId: group.id, deletedAt: null },
        select: { currency: true, exchangeRate: true, paidById: true, splits: { select: { participantId: true, amountCents: true } } },
      }),
      prisma.settlement.findMany({
        where: { groupId: group.id, deletedAt: null },
        select: { currency: true, exchangeRate: true, fromId: true, toId: true, amountCents: true },
      }),
    ])
    return computeBalances(
      group.baseCurrency,
      participants.map((p) => p.id),
      expenses,
      settlements,
    )
  }),
})
