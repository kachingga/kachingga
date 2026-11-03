import { z } from 'zod'
import { prisma } from '../../db'
import { paymentAlias } from '../../schemas'
import { protectedProcedure, router } from '../init'

export const profileRouter = router({
  // The logged-in user's settings. Today: the alias/CVU used in every group (unless a group overrides it).
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await prisma.userProfile.findUnique({ where: { userId: ctx.user.id } })
    return { paymentAlias: profile?.paymentAlias ?? null }
  }),

  update: protectedProcedure.input(z.object({ paymentAlias })).mutation(async ({ ctx, input }) => {
    const profile = await prisma.userProfile.upsert({
      where: { userId: ctx.user.id },
      create: { userId: ctx.user.id, paymentAlias: input.paymentAlias },
      update: { paymentAlias: input.paymentAlias },
    })
    return { paymentAlias: profile.paymentAlias }
  }),
})
