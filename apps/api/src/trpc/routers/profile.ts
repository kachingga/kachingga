import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '../../db'
import { getSupabase } from '../../lib/supabase'
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

  // Deletes the caller's account (no input: only ever the caller's). Their participants stay in
  // every group without account (name, expenses, payments and balances untouched); what is only
  // theirs goes (account alias, group aliases, saved filters). `createdById` fields stay as history.
  // DB first, then Supabase: a deleted account is never still linked to a group, and the DB part
  // is idempotent, so retrying after a Supabase failure just finishes the job.
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id
    await prisma.$transaction([
      prisma.participant.updateMany({ where: { userId }, data: { userId: null, paymentAlias: null } }),
      prisma.userProfile.deleteMany({ where: { userId } }),
      prisma.savedFilter.deleteMany({ where: { userId } }),
    ])
    // Soft delete: they can't sign in again and their tokens stop working. Irreversible.
    const { error } = await getSupabase().auth.admin.deleteUser(userId, true)
    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No se pudo terminar de borrar la cuenta. Intentá de nuevo.',
        cause: error,
      })
    }
    return { ok: true }
  }),
})
