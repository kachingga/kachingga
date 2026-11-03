import { TRPCError } from '@trpc/server'
import { prisma } from '../db'

// The caller's participant in the group; NOT_FOUND if they're not a member (don't leak that it exists).
export async function requireMembership(groupId: string, userId: string) {
  const participant = await prisma.participant.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  })
  if (!participant) throw new TRPCError({ code: 'NOT_FOUND', message: 'Grupo no encontrado' })
  return participant
}

export async function requireActiveGroup(groupId: string, userId: string) {
  const membership = await requireMembership(groupId, userId)
  if (membership.group.archivedAt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'El grupo está archivado' })
  }
  return membership
}

// Every participant id must belong to the group.
export async function assertParticipantsInGroup(groupId: string, participantIds: string[]) {
  const unique = [...new Set(participantIds)]
  const count = await prisma.participant.count({ where: { groupId, id: { in: unique } } })
  if (count !== unique.length) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Hay participantes que no son del grupo' })
  }
}
