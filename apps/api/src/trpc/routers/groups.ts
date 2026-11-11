import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { Prisma } from '../../db/generated/prisma/client'
import type { Currency } from '../../db/generated/prisma/enums'
import { prisma } from '../../db'
import { requireActiveGroup, requireMembership } from '../../lib/access'
import { defaultCategoryRows } from '../../lib/categories'
import { generateInviteCode, INVITE_CODE_LENGTH } from '../../lib/inviteCode'
import { resolvePaymentAliases } from '../../lib/paymentAlias'
import { assertCanCreateGroup, assertRoomForParticipant } from '../../lib/quotas'
import { groupInput, id, participantName } from '../../schemas'
import { protectedProcedure, router } from '../init'

const groupId = z.object({ groupId: id })

// What a member gets of a group: never `createdById` (another member's account id).
const groupSelect = {
  id: true,
  name: true,
  baseCurrency: true,
  inviteCode: true,
  createdAt: true,
  archivedAt: true,
} satisfies Prisma.GroupSelect

const inviteCode = z.string().trim().toUpperCase().length(INVITE_CODE_LENGTH, 'Código inválido')

// My balance in each group and currency, added up in the database (without loading every share):
// what computeBalances (lib/balances.ts) gives for my participant, with the same rules. Each movement
// counts in the balance balanceCurrency says (converted → base, kept → its own currency); each share
// and payment is converted and rounded on its own, half up like Math.round; what I paid is the sum of
// the converted shares. Not FLOOR(x + 0.5): adding 0.5 rounds 0.49999999999999994 up, while
// x - FLOOR(x) is exact for x ≥ 0. groupsListBalances.test.ts compares both on the same data.
async function myBalancesByGroup(userId: string, groupIds: string[]) {
  const byGroup = new Map<string, Map<Currency, number>>()
  if (groupIds.length === 0) return byGroup
  const rows = await prisma.$queryRaw<{ groupId: string; currency: Currency; amountCents: bigint }[]>`
    WITH me AS (
      SELECT p."id" AS pid, p."groupId" AS gid, g."baseCurrency" AS base
      FROM "Participant" p JOIN "Group" g ON g."id" = p."groupId"
      WHERE p."userId" = ${userId} AND p."groupId" IN (${Prisma.join(groupIds)})
    ),
    expense AS (
      SELECT e."id", me.gid, me.pid, e."paidById",
        CASE WHEN e."currency" <> me.base AND e."exchangeRate" IS NOT NULL THEN me.base ELSE e."currency" END AS currency,
        CASE WHEN e."currency" <> me.base AND e."exchangeRate" IS NOT NULL THEN e."exchangeRate" ELSE 1 END AS rate
      FROM "Expense" e JOIN me ON e."groupId" = me.gid
      WHERE e."deletedAt" IS NULL
    ),
    movement AS (
      -- + every share of the expenses I paid
      SELECT x.gid, x.currency, s."amountCents" * x.rate AS amount, 1 AS sign
      FROM expense x JOIN "ExpenseSplit" s ON s."expenseId" = x."id"
      WHERE x."paidById" = x.pid
      UNION ALL
      -- − my shares
      SELECT x.gid, x.currency, s."amountCents" * x.rate, -1
      FROM expense x JOIN "ExpenseSplit" s ON s."expenseId" = x."id" AND s."participantId" = x.pid
      UNION ALL
      -- + the payments I made, − the ones I got
      SELECT me.gid,
        CASE WHEN t."currency" <> me.base AND t."exchangeRate" IS NOT NULL THEN me.base ELSE t."currency" END,
        t."amountCents" * CASE WHEN t."currency" <> me.base AND t."exchangeRate" IS NOT NULL THEN t."exchangeRate" ELSE 1 END,
        CASE WHEN t."fromId" = me.pid THEN 1 ELSE -1 END
      FROM "Settlement" t JOIN me ON t."groupId" = me.gid
      WHERE t."deletedAt" IS NULL AND me.pid IN (t."fromId", t."toId")
    )
    SELECT gid AS "groupId", currency::text AS currency,
      SUM(sign * (CASE WHEN amount - FLOOR(amount) >= 0.5::float8 THEN CEIL(amount) ELSE FLOOR(amount) END)::bigint)::bigint AS "amountCents"
    FROM movement
    GROUP BY gid, currency`
  for (const row of rows) {
    const balances = byGroup.get(row.groupId) ?? new Map<Currency, number>()
    balances.set(row.currency, Number(row.amountCents))
    byGroup.set(row.groupId, balances)
  }
  return byGroup
}

export const groupsRouter = router({
  // My groups, each with its people (`participants`: id and name, oldest first, for the faces on the
  // list), my name in it (`myName`) and my balance in its base currency (`myBalanceCents`: positive =
  // they owe me). `myBalances`: every currency where my balance isn't zero, base first (what I'd
  // leave pending if I deleted my account). Two queries in total, whatever the number of groups and
  // their expenses: the balances are added up in the database (myBalancesByGroup).
  list: protectedProcedure.input(z.object({ includeArchived: z.boolean().default(false) }).optional()).query(async ({ ctx, input }) => {
    const groups = await prisma.group.findMany({
      where: {
        participants: { some: { userId: ctx.user.id } },
        ...(input?.includeArchived ? {} : { archivedAt: null }),
      },
      select: {
        ...groupSelect,
        _count: { select: { participants: true } },
        participants: { select: { id: true, name: true, userId: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const balances = await myBalancesByGroup(
      ctx.user.id,
      groups.map((g) => g.id),
    )
    return groups.map(({ participants, ...group }) => {
      const me = participants.find((p) => p.userId === ctx.user.id)!
      const mine = balances.get(group.id) ?? new Map<Currency, number>()
      const base = group.baseCurrency
      return {
        ...group,
        participants: participants.map(({ id, name }) => ({ id, name })),
        myName: me.name,
        myBalanceCents: mine.get(base) ?? 0,
        // Base first, then the others alphabetically (like computeBalances)
        myBalances: [...mine]
          .filter(([, amountCents]) => amountCents !== 0)
          .sort(([a], [b]) => (a === base ? -1 : b === base ? 1 : a.localeCompare(b)))
          .map(([currency, amountCents]) => ({ currency, amountCents })),
      }
    })
  }),

  get: protectedProcedure.input(groupId).query(async ({ ctx, input }) => {
    const me = await requireMembership(input.groupId, ctx.user.id)
    const participants = await prisma.participant.findMany({
      where: { groupId: input.groupId },
      orderBy: { createdAt: 'asc' },
    })
    const aliases = await resolvePaymentAliases(participants)
    const group = me.group
    return {
      // The fields of groupSelect
      id: group.id,
      name: group.name,
      baseCurrency: group.baseCurrency,
      inviteCode: group.inviteCode,
      createdAt: group.createdAt,
      archivedAt: group.archivedAt,
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

  create: protectedProcedure.input(groupInput.extend({ myName: participantName })).mutation(async ({ ctx, input }) => {
    await assertCanCreateGroup(ctx.user.id)
    return prisma.group.create({
      data: {
        name: input.name,
        baseCurrency: input.baseCurrency,
        inviteCode: generateInviteCode(),
        createdById: ctx.user.id,
        participants: { create: { name: input.myName, userId: ctx.user.id } },
        categories: { create: defaultCategoryRows() },
      },
      select: groupSelect,
    })
  }),

  rename: protectedProcedure.input(groupId.extend({ name: groupInput.shape.name })).mutation(async ({ ctx, input }) => {
    await requireActiveGroup(input.groupId, ctx.user.id)
    return prisma.group.update({ where: { id: input.groupId }, data: { name: input.name }, select: groupSelect })
  }),

  setArchived: protectedProcedure.input(groupId.extend({ archived: z.boolean() })).mutation(async ({ ctx, input }) => {
    await requireMembership(input.groupId, ctx.user.id)
    return prisma.group.update({
      where: { id: input.groupId },
      data: { archivedAt: input.archived ? new Date() : null },
      select: groupSelect,
    })
  }),

  regenerateInviteCode: protectedProcedure.input(groupId).mutation(async ({ ctx, input }) => {
    await requireActiveGroup(input.groupId, ctx.user.id)
    return prisma.group.update({ where: { id: input.groupId }, data: { inviteCode: generateInviteCode() }, select: groupSelect })
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
    .input(z.union([z.object({ inviteCode, participantId: id }), z.object({ inviteCode, name: participantName })]))
    .mutation(async ({ ctx, input }) => {
      const group = await prisma.group.findUnique({ where: { inviteCode: input.inviteCode } })
      if (!group || group.archivedAt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Código inválido' })

      const existing = await prisma.participant.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: ctx.user.id } },
      })
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Ya sos parte de este grupo' })

      if ('participantId' in input) {
        // Only claim if still unclaimed (guards against two people claiming at once).
        // Starts without a group alias: whoever claims it uses their account's (#106).
        const { count } = await prisma.participant.updateMany({
          where: { id: input.participantId, groupId: group.id, userId: null },
          data: { userId: ctx.user.id, paymentAlias: null },
        })
        if (count === 0) throw new TRPCError({ code: 'CONFLICT', message: 'Ese participante ya tiene cuenta' })
      } else {
        await assertRoomForParticipant(group.id)
        await prisma.participant.create({ data: { groupId: group.id, name: input.name, userId: ctx.user.id } })
      }
      return { groupId: group.id }
    }),
})
