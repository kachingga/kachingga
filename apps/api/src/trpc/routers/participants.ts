import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '../../db'
import { requireActiveGroup } from '../../lib/access'
import { participantName } from '../../schemas'
import { protectedProcedure, router } from '../init'

async function findParticipant(participantId: string, userId: string) {
  const participant = await prisma.participant.findUnique({ where: { id: participantId } })
  if (!participant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Participante no encontrado' })
  await requireActiveGroup(participant.groupId, userId)
  return participant
}

export const participantsRouter = router({
  // Someone without an account (yet). They can claim it later with the invite code.
  add: protectedProcedure
    .input(z.object({ groupId: z.string(), name: participantName }))
    .mutation(async ({ ctx, input }) => {
      await requireActiveGroup(input.groupId, ctx.user.id)
      return prisma.participant.create({ data: { groupId: input.groupId, name: input.name } })
    }),

  rename: protectedProcedure
    .input(z.object({ participantId: z.string(), name: participantName }))
    .mutation(async ({ ctx, input }) => {
      await findParticipant(input.participantId, ctx.user.id)
      return prisma.participant.update({ where: { id: input.participantId }, data: { name: input.name } })
    }),

  // Only for participants without account that never appear in an expense or settlement.
  remove: protectedProcedure.input(z.object({ participantId: z.string() })).mutation(async ({ ctx, input }) => {
    const participant = await findParticipant(input.participantId, ctx.user.id)
    if (participant.userId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No se puede quitar a alguien que ya tiene cuenta' })
    }
    const used = await prisma.participant.findUnique({
      where: { id: participant.id },
      select: { _count: { select: { expensesPaid: true, splits: true, settlementsPaid: true, settlementsGotten: true } } },
    })
    const counts = used?._count
    if (counts && counts.expensesPaid + counts.splits + counts.settlementsPaid + counts.settlementsGotten > 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tiene gastos o pagos cargados; no se puede quitar' })
    }
    await prisma.participant.delete({ where: { id: participant.id } })
    return { ok: true }
  }),
})
