import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { prisma } from '../../db'
import { requireActiveGroup, requireMembership } from '../../lib/access'
import { computeBalances } from '../../lib/balances'
import { defaultCategoryRows } from '../../lib/categories'
import { generateInviteCode } from '../../lib/inviteCode'
import { resolvePaymentAliases } from '../../lib/paymentAlias'
import { groupInput, participantName } from '../../schemas'
import { protectedProcedure, router } from '../init'

const groupId = z.object({ groupId: z.string() })
const inviteCode = z.string().trim().toUpperCase().min(1)

export const groupsRouter = router({
  // My groups, each with its people (`participants`: id and name, oldest first, for the faces on the
  // list) and my balance in its base currency (`myBalanceCents`: positive = they owe me).
  // Three queries in total, whatever the number of groups.
  list: protectedProcedure.input(z.object({ includeArchived: z.boolean().default(false) }).optional()).query(async ({ ctx, input }) => {
    const groups = await prisma.group.findMany({
      where: {
        participants: { some: { userId: ctx.user.id } },
        ...(input?.includeArchived ? {} : { archivedAt: null }),
      },
      include: {
        _count: { select: { participants: true } },
        participants: { select: { id: true, name: true, userId: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const groupIds = groups.map((g) => g.id)
    const [expenses, settlements] = await Promise.all([
      prisma.expense.findMany({
        where: { groupId: { in: groupIds }, deletedAt: null },
        select: {
          groupId: true,
          currency: true,
          exchangeRate: true,
          paidById: true,
          splits: { select: { participantId: true, amountCents: true } },
        },
      }),
      prisma.settlement.findMany({
        where: { groupId: { in: groupIds }, deletedAt: null },
        select: { groupId: true, currency: true, exchangeRate: true, fromId: true, toId: true, amountCents: true },
      }),
    ])
    return groups.map(({ participants, ...group }) => {
      const myId = participants.find((p) => p.userId === ctx.user.id)!.id
      const base = computeBalances(
        group.baseCurrency,
        [myId],
        expenses.filter((e) => e.groupId === group.id),
        settlements.filter((s) => s.groupId === group.id),
      ).find((b) => b.currency === group.baseCurrency)!
      const myBalanceCents = base.balances.find((b) => b.participantId === myId)?.amountCents ?? 0
      return { ...group, participants: participants.map(({ id, name }) => ({ id, name })), myBalanceCents }
    })
  }),

  get: protectedProcedure.input(groupId).query(async ({ ctx, input }) => {
    const me = await requireMembership(input.groupId, ctx.user.id)
    const participants = await prisma.participant.findMany({
      where: { groupId: input.groupId },
      orderBy: { createdAt: 'asc' },
    })
    const aliases = await resolvePaymentAliases(participants)
    return {
      ...me.group,
      myParticipantId: me.id,
      participants: participants.map((p) => ({
        id: p.id,
        name: p.name,
        hasAccount: p.userId !== null,
        isMe: p.id === me.id,
        // Alias/CVU to pay this person in this group ('group' = set for this group, 'account' = from their account)
        ...aliases.get(p.id)!,
      })),
    }
  }),

  create: protectedProcedure.input(groupInput.extend({ myName: participantName })).mutation(({ ctx, input }) =>
    prisma.group.create({
      data: {
        name: input.name,
        baseCurrency: input.baseCurrency,
        inviteCode: generateInviteCode(),
        createdById: ctx.user.id,
        participants: { create: { name: input.myName, userId: ctx.user.id } },
        categories: { create: defaultCategoryRows() },
      },
    }),
  ),

  rename: protectedProcedure.input(groupId.extend({ name: groupInput.shape.name })).mutation(async ({ ctx, input }) => {
    await requireActiveGroup(input.groupId, ctx.user.id)
    return prisma.group.update({ where: { id: input.groupId }, data: { name: input.name } })
  }),

  setArchived: protectedProcedure.input(groupId.extend({ archived: z.boolean() })).mutation(async ({ ctx, input }) => {
    await requireMembership(input.groupId, ctx.user.id)
    return prisma.group.update({
      where: { id: input.groupId },
      data: { archivedAt: input.archived ? new Date() : null },
    })
  }),

  regenerateInviteCode: protectedProcedure.input(groupId).mutation(async ({ ctx, input }) => {
    await requireActiveGroup(input.groupId, ctx.user.id)
    return prisma.group.update({ where: { id: input.groupId }, data: { inviteCode: generateInviteCode() } })
  }),

  // What the user sees after typing an invite code, before joining.
  preview: protectedProcedure.input(z.object({ inviteCode })).query(async ({ ctx, input }) => {
    const group = await prisma.group.findUnique({
      where: { inviteCode: input.inviteCode },
      include: { participants: { orderBy: { createdAt: 'asc' } } },
    })
    if (!group || group.archivedAt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Código inválido' })
    return {
      id: group.id,
      name: group.name,
      baseCurrency: group.baseCurrency,
      alreadyMember: group.participants.some((p) => p.userId === ctx.user.id),
      unclaimedParticipants: group.participants.filter((p) => p.userId === null).map((p) => ({ id: p.id, name: p.name })),
    }
  }),

  // Join by claiming an existing participant without account, or as a new participant.
  join: protectedProcedure
    .input(z.union([z.object({ inviteCode, participantId: z.string() }), z.object({ inviteCode, name: participantName })]))
    .mutation(async ({ ctx, input }) => {
      const group = await prisma.group.findUnique({ where: { inviteCode: input.inviteCode } })
      if (!group || group.archivedAt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Código inválido' })

      const existing = await prisma.participant.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: ctx.user.id } },
      })
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Ya sos parte de este grupo' })

      if ('participantId' in input) {
        // Only claim if still unclaimed (guards against two people claiming at once).
        const { count } = await prisma.participant.updateMany({
          where: { id: input.participantId, groupId: group.id, userId: null },
          data: { userId: ctx.user.id },
        })
        if (count === 0) throw new TRPCError({ code: 'CONFLICT', message: 'Ese participante ya tiene cuenta' })
      } else {
        await prisma.participant.create({ data: { groupId: group.id, name: input.name, userId: ctx.user.id } })
      }
      return { groupId: group.id }
    }),
})
