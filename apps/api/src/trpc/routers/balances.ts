import { z } from 'zod'
import { prisma } from '../../db'
import { requireMembership } from '../../lib/access'
import { groupBalanceTotals } from '../../lib/aggregates'
import { currencyBalances } from '../../lib/balances'
import { id } from '../../schemas'
import { protectedProcedure, router } from '../init'

export const balancesRouter = router({
  // One entry per currency (base first): balance per participant + suggested minimal transfers.
  get: protectedProcedure.input(z.object({ groupId: id })).query(async ({ ctx, input }) => {
    const { group } = await requireMembership(input.groupId, ctx.user.id)
    // Each participant's totals are added up in the database (lib/aggregates.ts); the order of the
    // participants and the transfers come from currencyBalances, like computeBalances.
    const [participants, totals] = await Promise.all([
      prisma.participant.findMany({ where: { groupId: group.id }, select: { id: true } }),
      groupBalanceTotals(group.id),
    ])
    return currencyBalances(
      group.baseCurrency,
      participants.map((p) => p.id),
      totals,
    )
  }),
})
