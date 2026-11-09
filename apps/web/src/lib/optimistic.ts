import type { AppRouter } from '@kachingga/api';
import { distributeCents, type ExpenseInput, type SettlementInput } from '@kachingga/api/schemas';
import type { inferRouterOutputs } from '@trpc/server';

// Builds what the API would return for an expense or payment that's still being saved, so the
// screens can show it right away (optimistic updates). The server's answer replaces it.

type Outputs = inferRouterOutputs<AppRouter>;
type Group = Outputs['groups']['get'];
export type Expense = Outputs['expenses']['get'];
export type Settlement = Outputs['settlements']['list'][number];
export type ExpensePage = Outputs['expenses']['list'];

const TEMP_PREFIX = 'temp-';

/** A fresh id for something not saved yet. */
export function tempId(): string {
  return `${TEMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Whether it's still being saved (it has no detail screen yet). */
export function isTemp(id: string): boolean {
  return id.startsWith(TEMP_PREFIX);
}

function person(group: Group, id: string) {
  return { id, name: group.participants.find((p) => p.id === id)?.name ?? '' };
}

/** The shares the API will store (same cent distribution, see `distributeCents`). */
function shares(amountCents: number, split: ExpenseInput['split']) {
  if (split.type === 'EQUAL') {
    const cents = distributeCents(
      amountCents,
      split.participantIds.map(() => 1),
    );
    return split.participantIds.map((id, i) => ({ id, cents: cents[i]!, percentage: null }));
  }
  if (split.type === 'AMOUNT') {
    return split.shares.map((s) => ({
      id: s.participantId,
      cents: s.amountCents,
      percentage: null,
    }));
  }
  const cents = distributeCents(
    amountCents,
    split.shares.map((s) => s.percentage),
  );
  return split.shares.map((s, i) => ({
    id: s.participantId,
    cents: cents[i]!,
    percentage: s.percentage,
  }));
}

/** An expense as `expenses.get` / `expenses.list` return it, from what the form sends. */
export function buildExpense(
  input: Omit<ExpenseInput, 'groupId'>,
  group: Group,
  id: string,
  previous?: Expense,
  category?: Expense['category'],
): Expense {
  // The category the expense will show: the one picked (from `categories.list`), or what it had.
  const shownCategory = category ??
    previous?.category ?? { id: '', name: 'Otros', icon: 'shapes', color: 'muted' };
  const now = new Date();
  return {
    id,
    groupId: group.id,
    description: input.description,
    categoryId: shownCategory.id,
    category: shownCategory,
    date: input.date,
    amountCents: input.amountCents,
    currency: input.currency,
    exchangeRate: input.exchangeRate ?? null,
    splitType: input.split.type,
    paidById: input.paidById,
    createdById: previous?.createdById ?? '',
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    deletedAt: null,
    paidBy: person(group, input.paidById),
    splits: shares(input.amountCents, input.split).map((s) => ({
      id: `${id}-${s.id}`,
      expenseId: id,
      participantId: s.id,
      amountCents: s.cents,
      percentage: s.percentage,
      participant: person(group, s.id),
    })),
  } as Expense;
}

/** A payment as `settlements.list` returns it, from what the form sends. */
export function buildSettlement(input: SettlementInput, group: Group): Settlement {
  const now = new Date();
  return {
    id: tempId(),
    groupId: group.id,
    fromId: input.fromId,
    toId: input.toId,
    amountCents: input.amountCents,
    currency: input.currency,
    exchangeRate: input.exchangeRate ?? null,
    date: input.date,
    note: input.note ?? null,
    createdById: '',
    createdAt: now,
    deletedAt: null,
    from: person(group, input.fromId),
    to: person(group, input.toId),
  } as Settlement;
}

/** Newest first, like the API (by date, then the most recently created). */
export function byDateDesc<T extends { date: Date | string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
