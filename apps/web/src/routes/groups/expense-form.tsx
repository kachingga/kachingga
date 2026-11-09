import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';
import { currencies, distributeCents, expenseCategories } from '@kachingga/api/schemas';

import { ExchangeRateFields } from '@/components/exchange-rate-fields';
import { NumberInput } from '@/components/number-input';
import { useExchangeRate } from '@/lib/use-exchange-rate';
import { ArchivedNotice } from '@/components/archived-notice';
import { ErrorState } from '@/components/error-state';
import { FormSkeleton } from '@/components/skeletons';
import { useTRPC } from '@/lib/trpc';
import { useGoBack } from '@/lib/use-go-back';
import { buildExpense, byDateDesc, tempId, type Expense } from '@/lib/optimistic';
import {
  categoryLabels,
  centsToNumeric,
  currencyLabels,
  dayToDate,
  formatCents,
  formatNumber,
  toCents,
  toNumber,
  toNumeric,
  toDay,
  today,
  type Currency,
  type ExpenseCategory,
} from '@/lib/format';

type GroupData = inferRouterOutputs<AppRouter>['groups']['get'];
type ExpenseData = inferRouterOutputs<AppRouter>['expenses']['get'];

// ─── Inner form (renders only when group + optional expense are ready) ────────

interface FormProps {
  groupId: string;
  group: GroupData;
  expenseId?: string;
  expense?: ExpenseData;
}

function ExpenseFormBody({ groupId, group, expenseId, expense }: FormProps) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const base = group.baseCurrency as Currency;
  const participants = group.participants;
  const allIds = participants.map((p) => p.id);
  const isEdit = !!expenseId;

  // Initial values from existing expense or defaults
  const initCurrency = (expense?.currency ?? base) as Currency;

  // Form state
  const [description, setDescription] = useState(expense?.description ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(
    (expense?.category as ExpenseCategory) ?? 'OTHER',
  );
  const [dateInput, setDateInput] = useState(expense ? toDay(expense.date) : today());
  const [amountInput, setAmountInput] = useState(
    expense ? centsToNumeric(expense.amountCents) : '',
  );
  const [currency, setCurrency] = useState<Currency>(initCurrency);
  const [paidById, setPaidById] = useState(expense?.paidById ?? group.myParticipantId);
  const rate = useExchangeRate(
    base,
    currency,
    expense && {
      exchangeRate: expense.exchangeRate,
      keepCurrency: expense.currency !== base && expense.exchangeRate === null,
    },
  );
  const [splitType, setSplitType] = useState<'EQUAL' | 'AMOUNT' | 'PERCENTAGE'>(
    (expense?.splitType as 'EQUAL' | 'AMOUNT' | 'PERCENTAGE') ?? 'EQUAL',
  );
  const [equalIds, setEqualIds] = useState<string[]>(
    expense ? expense.splits.map((s) => s.participantId) : allIds,
  );
  const [amountShares, setAmountShares] = useState<Record<string, string>>(() => {
    if (expense?.splitType === 'AMOUNT') {
      return Object.fromEntries(
        expense.splits.map((s) => [s.participantId, centsToNumeric(s.amountCents)]),
      );
    }
    return Object.fromEntries(allIds.map((id) => [id, '']));
  });
  const [percentShares, setPercentShares] = useState<Record<string, string>>(() => {
    if (expense?.splitType === 'PERCENTAGE') {
      return Object.fromEntries(
        expense.splits.map((s) => [s.participantId, toNumeric(s.percentage ?? 0)]),
      );
    }
    return Object.fromEntries(allIds.map((id) => [id, '']));
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Mutations: optimistic. The form closes right away showing the expense as saved; if the API
  // rejects it, it's taken back and a toast offers to reopen the form with what was entered.
  const listKey = trpc.expenses.list.infiniteQueryKey({ groupId });
  const refresh = () => {
    void queryClient.invalidateQueries(trpc.expenses.pathFilter());
    void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId }));
  };
  const reopen = (path: string, draft: Expense) =>
    navigate(path, { state: { draft } satisfies FormState });

  const create = useMutation(
    trpc.expenses.create.mutationOptions({
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData(listKey);
        const draft = buildExpense(input, group, tempId());
        queryClient.setQueryData(listKey, (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page, i) =>
                  i === 0 ? { ...page, items: byDateDesc([draft, ...page.items]) } : page,
                ),
              }
            : old,
        );
        goBack(`/grupos/${groupId}`);
        return { previous, draft };
      },
      onError: (err, _input, context) => {
        // No context: it failed before the optimistic update (e.g. offline); the form is still open.
        if (!context) return void toast.error(err.message);
        queryClient.setQueryData(listKey, context.previous);
        toast.error(`No se guardó "${context.draft.description}": ${err.message}`, {
          duration: 10_000,
          action: {
            label: 'Revisar',
            onClick: () => reopen(`/grupos/${groupId}/gastos/nuevo`, context.draft),
          },
        });
      },
      onSettled: refresh,
    }),
  );

  const update = useMutation(
    trpc.expenses.update.mutationOptions({
      onMutate: async ({ expenseId: id, ...input }) => {
        const detailKey = trpc.expenses.get.queryKey({ expenseId: id });
        await queryClient.cancelQueries({ queryKey: detailKey });
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = {
          detail: queryClient.getQueryData(detailKey),
          list: queryClient.getQueryData(listKey),
        };
        const draft = buildExpense({ ...input }, group, id, expense);
        queryClient.setQueryData(detailKey, draft);
        queryClient.setQueryData(listKey, (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) => (item.id === id ? draft : item)),
                })),
              }
            : old,
        );
        goBack(`/grupos/${groupId}/gastos/${id}`);
        return { previous, draft, detailKey };
      },
      onError: (err, _input, context) => {
        // No context: it failed before the optimistic update (e.g. offline); the form is still open.
        if (!context) return void toast.error(err.message);
        queryClient.setQueryData(context.detailKey, context.previous.detail);
        queryClient.setQueryData(listKey, context.previous.list);
        toast.error(`No se guardaron los cambios: ${err.message}`, {
          duration: 10_000,
          action: {
            label: 'Revisar',
            onClick: () =>
              reopen(`/grupos/${groupId}/gastos/${context.draft.id}/editar`, context.draft),
          },
        });
      },
      onSettled: refresh,
    }),
  );

  function buildSplit() {
    if (splitType === 'EQUAL') {
      return { type: 'EQUAL' as const, participantIds: equalIdsInOrder };
    }
    if (splitType === 'AMOUNT') {
      return {
        type: 'AMOUNT' as const,
        shares: Object.entries(amountShares)
          .filter(([, v]) => toCents(v) > 0)
          .map(([participantId, v]) => ({ participantId, amountCents: toCents(v) })),
      };
    }
    return {
      type: 'PERCENTAGE' as const,
      shares: Object.entries(percentShares)
        .filter(([, v]) => (toNumber(v) ?? 0) > 0)
        .map(([participantId, v]) => ({ participantId, percentage: toNumber(v)! })),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const amountCents = toCents(amountInput);
    if (amountCents <= 0) {
      setFormError('El monto tiene que ser mayor a cero');
      return;
    }

    // Same checks as the API, so an expense shown as saved isn't rejected afterwards.
    const splitError =
      splitType === 'EQUAL'
        ? equalIdsInOrder.length === 0 && 'Elegí al menos una persona para dividir'
        : splitType === 'AMOUNT'
          ? amountSumCents !== amountCents && 'La suma de los montos no coincide con el total'
          : Math.abs(percentSum - 100) > 0.001 && 'Los porcentajes tienen que sumar 100';
    if (splitError) {
      setFormError(splitError);
      return;
    }

    if (rate.missingRateError) {
      setFormError(rate.missingRateError);
      return;
    }

    const common = {
      description,
      category,
      date: dayToDate(dateInput),
      amountCents,
      currency,
      exchangeRate: rate.exchangeRate,
      keepCurrency: currency !== base && rate.keepCurrency,
      paidById,
      split: buildSplit(),
    };

    if (isEdit) {
      update.mutate({ expenseId: expenseId!, ...common });
    } else {
      create.mutate({ groupId, ...common });
    }
  }

  const isSaving = create.isPending || update.isPending;

  // Amount sums for live feedback
  const amountSumCents = Object.values(amountShares).reduce((s, v) => s + toCents(v), 0);
  const percentSum = Object.values(percentShares).reduce((s, v) => s + (toNumber(v) ?? 0), 0);
  const totalCents = toCents(amountInput);
  // Same split as the API (leftover cents to the first ones, in the group's order).
  const equalIdsInOrder = allIds.filter((id) => equalIds.includes(id));
  const equalShares = new Map(
    totalCents > 0 && equalIdsInOrder.length > 0
      ? distributeCents(
          totalCents,
          equalIdsInOrder.map(() => 1),
        ).map((cents, i) => [equalIdsInOrder[i]!, cents])
      : [],
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rise flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="press grid size-9 shrink-0 place-items-center rounded-full text-lg text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-bold lg:text-3xl">
          {isEdit ? 'Editar gasto' : 'Agregar gasto'}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rise space-y-5 rounded-2xl border bg-card p-5 shadow-soft"
      >
        {/* Monto */}
        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="amount">
            Monto
          </label>
          <NumberInput
            id="amount"
            value={amountInput}
            onValueChange={setAmountInput}
            required
            placeholder="0"
            className="mt-1.5 h-14 font-display text-3xl font-bold tabular w-full rounded-xl border border-input bg-card px-3.5 text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="description">
            Descripción
          </label>
          <input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Cena"
            className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          />
        </div>

        {/* Categoría y fecha */}
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="category">
              Categoría
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            >
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="date">
              Fecha
            </label>
            <input
              id="date"
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              required
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            />
          </div>
        </div>

        {/* Quién pagó */}
        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="paidBy">
            Quién pagó
          </label>
          <select
            id="paidBy"
            value={paidById}
            onChange={(e) => setPaidById(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          >
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isMe ? ' (yo)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Moneda */}
        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="currency">
            Moneda
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => {
              const c = e.target.value as Currency;
              setCurrency(c);
              rate.resetFor(c);
            }}
            className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {currencyLabels[c]}
              </option>
            ))}
          </select>
        </div>

        <ExchangeRateFields rate={rate} amountCents={totalCents} />

        {/* División */}
        <div>
          <label className="block text-sm font-medium text-foreground">Dividir</label>
          <div className="mt-1 flex gap-2">
            {(['EQUAL', 'AMOUNT', 'PERCENTAGE'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSplitType(t)}
                className={`press flex-1 rounded-full py-2 text-sm font-medium ${splitType === t ? 'bg-primary text-primary-foreground' : 'border border-input bg-card text-muted-foreground'}`}
              >
                {t === 'EQUAL' ? 'Igual' : t === 'AMOUNT' ? 'Por monto' : 'Por %'}
              </button>
            ))}
          </div>

          {splitType === 'EQUAL' && (
            <div className="mt-3 space-y-2">
              {participants.map((p) => (
                <label key={p.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={equalIds.includes(p.id)}
                    onChange={(e) =>
                      setEqualIds(
                        e.target.checked
                          ? [...equalIds, p.id]
                          : equalIds.filter((id) => id !== p.id),
                      )
                    }
                  />
                  <span className="text-sm">
                    {p.name}
                    {p.isMe ? ' (yo)' : ''}
                  </span>
                  {equalShares.has(p.id) && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatCents(equalShares.get(p.id)!, currency)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}

          {splitType === 'AMOUNT' && (
            <div className="mt-3 space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">
                    {p.name}
                    {p.isMe ? ' (yo)' : ''}
                  </span>
                  <NumberInput
                    aria-label={`Monto de ${p.name}`}
                    value={amountShares[p.id] ?? ''}
                    onValueChange={(v) => setAmountShares({ ...amountShares, [p.id]: v })}
                    placeholder="0"
                    className="w-24 text-right h-11 rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                  />
                </div>
              ))}
              <p
                className={`text-xs ${amountSumCents === totalCents ? 'text-positive' : 'text-muted-foreground'}`}
              >
                Suma: {formatCents(amountSumCents, currency)} / {formatCents(totalCents, currency)}
                {amountSumCents !== totalCents &&
                  ` (faltan ${formatCents(totalCents - amountSumCents, currency)})`}
              </p>
            </div>
          )}

          {splitType === 'PERCENTAGE' && (
            <div className="mt-3 space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">
                    {p.name}
                    {p.isMe ? ' (yo)' : ''}
                  </span>
                  <div className="flex items-center gap-1">
                    <NumberInput
                      aria-label={`Porcentaje de ${p.name}`}
                      value={percentShares[p.id] ?? ''}
                      onValueChange={(v) => setPercentShares({ ...percentShares, [p.id]: v })}
                      placeholder="0"
                      className="w-20 text-right h-11 rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
              <p
                className={`text-xs ${Math.abs(percentSum - 100) < 0.01 ? 'text-positive' : 'text-muted-foreground'}`}
              >
                Total: {formatNumber(percentSum, 2)}% / 100%
                {Math.abs(percentSum - 100) >= 0.01 &&
                  ` (faltan ${formatNumber(100 - percentSum, 2)}%)`}
              </p>
            </div>
          )}
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="press h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-soft disabled:opacity-50"
        >
          {isSaving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar gasto'}
        </button>
      </form>
    </div>
  );
}

// ─── Outer loader ─────────────────────────────────────────────────────────────

/** Router state to reopen the form with what was entered (when saving failed). */
interface FormState {
  draft: Expense;
}

export function ExpenseForm() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const location = useLocation();
  const draft = (location.state as FormState | null)?.draft;
  const isEdit = !!expenseId;
  const trpc = useTRPC();
  const navigate = useNavigate();

  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));
  const expense = useQuery({
    ...trpc.expenses.get.queryOptions({ expenseId: expenseId! }),
    enabled: isEdit,
  });

  if (group.isPending || (isEdit && expense.isPending)) {
    return <FormSkeleton />;
  }
  if (group.isError) {
    return (
      <div className="p-6">
        <ErrorState message={group.error.message} onRetry={() => group.refetch()} />
      </div>
    );
  }
  if (isEdit && expense.isError) {
    return (
      <div className="p-6">
        <ErrorState message={expense.error.message} onRetry={() => expense.refetch()} />
      </div>
    );
  }

  if (group.data.archivedAt) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <ArchivedNotice groupId={groupId!} />
        <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground underline">
          Volver
        </button>
      </div>
    );
  }

  return (
    <ExpenseFormBody
      key={location.key}
      groupId={groupId!}
      group={group.data}
      expenseId={expenseId}
      expense={draft ?? (isEdit ? expense.data : undefined)}
    />
  );
}
