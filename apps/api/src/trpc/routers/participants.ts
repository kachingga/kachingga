import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Prisma } from '../../db/generated/prisma/client'
import { prisma } from '../../db'
import { requireActiveGroup } from '../../lib/access'
import { assertRoomForParticipant } from '../../lib/quotas'
import { id, participantName, paymentAlias } from '../../schemas'
import { protectedProcedure, router } from '../init'

// What the mutations return: never `userId` (any member can rename anyone, so it would expose the
// other members' account ids).
const participantSelect = { id: true, groupId: true, name: true, paymentAlias: true, createdAt: true } satisfies Prisma.ParticipantSelect

async function findParticipant(participantId: string, userId: string) {
  const participant = await prisma.participant.findUnique({ where: { id: participantId } })
  if (!participant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Participante no encontrado' })
  await requireActiveGroup(participant.groupId, userId)
  return participant
}

export const participantsRouter = router({
  // Someone without an account (yet). They can claim it later with the invite code.
  add: protectedProcedure.input(z.object({ groupId: id, name: participantName })).mutation(async ({ ctx, input }) => {
    await requireActiveGroup(input.groupId, ctx.user.id)
    await assertRoomForParticipant(input.groupId)
    return prisma.participant.create({ data: { groupId: input.groupId, name: input.name }, select: participantSelect })
  }),

  rename: protectedProcedure.input(z.object({ participantId: id, name: participantName })).mutation(async ({ ctx, input }) => {
    await findParticipant(input.participantId, ctx.user.id)
    return prisma.participant.update({ where: { id: input.participantId }, data: { name: input.name }, select: participantSelect })
  }),

  // Alias/CVU to get paid in this group (null = use the account's). Only for my own participant:
  // nobody sets someone else's, and participants without account have none (#106).
  setPaymentAlias: protectedProcedure.input(z.object({ participantId: id, paymentAlias })).mutation(async ({ ctx, input }) => {
    const participant = await findParticipant(input.participantId, ctx.user.id)
    if (participant.userId !== ctx.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Solo podés cambiar tu propio alias' })
    }
    return prisma.participant.update({
      where: { id: participant.id },
      data: { paymentAlias: input.paymentAlias },
      select: participantSelect,
    })
  }),

  // Only for participants without account that never appear in an expense or settlement.
  remove: protectedProcedure.input(z.object({ participantId: id })).mutation(async ({ ctx, input }) => {
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
    // Only while it still has no account: someone may have claimed it with the invite code meanwhile.
    const { count } = await prisma.participant.deleteMany({ where: { id: participant.id, userId: null } })
    if (count === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No se puede quitar a alguien que ya tiene cuenta' })
    return { ok: true }
  }),
})
