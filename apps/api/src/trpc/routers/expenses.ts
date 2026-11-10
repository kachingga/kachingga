import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Prisma } from '../../db/generated/prisma/client'
import type { Currency } from '../../db/generated/prisma/enums'
import { prisma } from '../../db'
import { assertParticipantsInGroup, requireActiveGroup, requireMembership } from '../../lib/access'
import { resolveExpenseCategory } from '../../lib/categories'
import { exportFilename, toCsv, toExportRows } from '../../lib/exportExpenses'
import { resolveExchangeRate } from '../../lib/rates'
import { resolveSplits } from '../../lib/splits'
import { summarizeExpenses } from '../../lib/summary'
import { expenseFilters, expenseInput, exportFormat, id, type ExpenseFilters } from '../../schemas'
import { protectedProcedure, router } from '../init'

const PAGE_SIZE = 50

const expenseInclude = {
  category: { select: { id: true, name: true, icon: true, color: true } },
  paidBy: { select: { id: true, name: true } },
  splits: { include: { participant: { select: { id: true, name: true } } } },
} satisfies Prisma.ExpenseInclude

export function buildExpenseWhere(groupId: string, filters: ExpenseFilters): Prisma.ExpenseWhereInput {
  return {
    groupId,
    deletedAt: null,
    ...(filters.paidById && { paidById: filters.paidById }),
    ...(filters.splitParticipantId && { splits: { some: { participantId: filters.splitParticipantId } } }),
    ...(filters.involvedParticipantId && {
      OR: [{ paidById: filters.involvedParticipantId }, { splits: { some: { participantId: filters.involvedParticipantId } } }],
    }),
    ...(filters.categoryIds?.length && { categoryId: { in: filters.categoryIds } }),
    ...((filters.dateFrom || filters.dateTo) && { date: { gte: filters.dateFrom, lte: filters.dateTo } }),
    ...((filters.minAmountCents != null || filters.maxAmountCents != null) && {
      amountCents: { gte: filters.minAmountCents, lte: filters.maxAmountCents },
    }),
    ...(filters.search && { description: { contains: filters.search, mode: 'insensitive' } }),
  }
}

// Validates an expense input against the group and turns it into the data to store.
// `currentCategoryId`: when editing, the category it already had (allowed even if archived).
async function prepareExpense(input: z.infer<typeof expenseInput>, baseCurrency: Currency, currentCategoryId?: string) {
  const splits = resolveSplits(input.amountCents, input.split)
  await assertParticipantsInGroup(input.groupId, [input.paidById, ...splits.map((s) => s.participantId)])
  const categoryId = await resolveExpenseCategory(input.groupId, input.categoryId, currentCategoryId)
  const exchangeRate = await resolveExchangeRate({ ...input, baseCurrency })
  return {
    data: {
      description: input.description,
      categoryId,
      date: input.date,
      amountCents: input.amountCents,
      currency: input.currency,
      exchangeRate,
      splitType: input.split.type,
      paidById: input.paidById,
    },
    splits,
  }
}

async function findExpense(expenseId: string, userId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } })
  if (!expense || expense.deletedAt) throw new TRPCError({ code: 'NOT_FOUND', message: 'Gasto no encontrado' })
  return { expense, membership: await requireMembership(expense.groupId, userId) }
}

export const expensesRouter = router({
  list: protectedProcedure
    .input(z.object({ groupId: id, filters: expenseFilters.default({}), cursor: id.nullish() }))
    .query(async ({ ctx, input }) => {
      await requireMembership(input.groupId, ctx.user.id)
      const items = await prisma.expense.findMany({
        where: buildExpenseWhere(input.groupId, input.filters),
        include: expenseInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE_SIZE + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      })
      const hasMore = items.length > PAGE_SIZE
      const page = hasMore ? items.slice(0, PAGE_SIZE) : items
      return { items: page, nextCursor: hasMore ? page[page.length - 1]!.id : null }
    }),

  // Totals for the same filters as `list` (e.g. "cuánto gasté en noviembre"), per currency.
  // All expenses matching the filters (no pagination), as a file to download: CSV (Excel/Sheets) or JSON.
  export: protectedProcedure
    .input(z.object({ groupId: id, filters: expenseFilters.default({}), format: exportFormat }))
    .query(async ({ ctx, input }) => {
      const me = await requireMembership(input.groupId, ctx.user.id)
      const expenses = await prisma.expense.findMany({
        where: buildExpenseWhere(input.groupId, input.filters),
        include: expenseInclude,
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      })
      const rows = toExportRows(me.group.baseCurrency, me.id, expenses)
      if (input.format === 'csv') {
        return { filename: exportFilename(me.group.name, 'csv'), mimeType: 'text/csv;charset=utf-8', content: toCsv(rows) }
      }
      const content = JSON.stringify(
        {
          grupo: me.group.name,
          moneda_base: me.group.baseCurrency,
          exportado: new Date().toISOString(),
          filtros: input.filters,
          gastos: rows,
        },
        null,
        2,
      )
      return { filename: exportFilename(me.group.name, 'json'), mimeType: 'application/json', content }
    }),

  summary: protectedProcedure.input(z.object({ groupId: id, filters: expenseFilters.default({}) })).query(async ({ ctx, input }) => {
    const me = await requireMembership(input.groupId, ctx.user.id)
    const expenses = await prisma.expense.findMany({
      where: buildExpenseWhere(input.groupId, input.filters),
      select: {
        currency: true,
        exchangeRate: true,
        category: { select: { id: true, name: true } },
        paidById: true,
        splits: { select: { participantId: true, amountCents: true } },
      },
    })
    return summarizeExpenses(me.group.baseCurrency, me.id, expenses)
  }),

  get: protectedProcedure.input(z.object({ expenseId: id })).query(async ({ ctx, input }) => {
    await findExpense(input.expenseId, ctx.user.id)
    return prisma.expense.findUniqueOrThrow({ where: { id: input.expenseId }, include: expenseInclude })
  }),

  create: protectedProcedure.input(expenseInput).mutation(async ({ ctx, input }) => {
    const { group } = await requireActiveGroup(input.groupId, ctx.user.id)
    const { data, splits } = await prepareExpense(input, group.baseCurrency)
    return prisma.expense.create({
      data: { ...data, groupId: input.groupId, createdById: ctx.user.id, splits: { create: splits } },
      include: expenseInclude,
    })
  }),

  update: protectedProcedure.input(expenseInput.omit({ groupId: true }).extend({ expenseId: id })).mutation(async ({ ctx, input }) => {
    const { expense } = await findExpense(input.expenseId, ctx.user.id)
    const { group } = await requireActiveGroup(expense.groupId, ctx.user.id)
    const { data, splits } = await prepareExpense({ ...input, groupId: expense.groupId }, group.baseCurrency, expense.categoryId)
    return prisma.expense.update({
      where: { id: expense.id },
      data: { ...data, splits: { deleteMany: {}, create: splits } },
      include: expenseInclude,
    })
  }),

  delete: protectedProcedure.input(z.object({ expenseId: id })).mutation(async ({ ctx, input }) => {
    const { expense } = await findExpense(input.expenseId, ctx.user.id)
    await requireActiveGroup(expense.groupId, ctx.user.id)
    await prisma.expense.update({ where: { id: expense.id }, data: { deletedAt: new Date() } })
    return { ok: true }
  }),
})
