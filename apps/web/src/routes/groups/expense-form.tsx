import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';
import { currencies, distributeCents, expenseCategories } from '@kachingga/api/schemas';

import { ExchangeRateFields } from '@/components/exchange-rate-fields';
import { NumberInput } from '@/components/number-input';
import { useExchangeRate } from '@/lib/use-exchange-rate';
import { ErrorState } from '@/components/error-state';
import { FormSkeleton } from '@/components/skeletons';
import { useTRPC } from '@/lib/trpc';
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

  // Mutations
  const create = useMutation(
    trpc.expenses.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.expenses.pathFilter());
        void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId }));
        navigate(`/grupos/${groupId}`);
      },
      onError: (err) => setFormError(err.message),
    }),
  );

  const update = useMutation(
    trpc.expenses.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.expenses.pathFilter());
        void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId }));
        navigate(`/grupos/${groupId}/gastos/${expenseId}`);
      },
      onError: (err) => setFormError(err.message),
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
    <main className="mx-auto min-h-dvh max-w-md p-6 pb-12">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-muted-foreground">
          ←
        </button>
        <h1 className="text-xl font-bold">{isEdit ? 'Editar gasto' : 'Agregar gasto'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Monto */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="amount">
            Monto
          </label>
          <NumberInput
            id="amount"
            value={amountInput}
            onValueChange={setAmountInput}
            required
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="description">
            Descripción
          </label>
          <input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Cena"
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Categoría y fecha */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-muted-foreground" htmlFor="category">
              Categoría
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground" htmlFor="date">
              Fecha
            </label>
            <input
              id="date"
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Quién pagó */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="paidBy">
            Quién pagó
          </label>
          <select
            id="paidBy"
            value={paidById}
            onChange={(e) => setPaidById(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="currency">
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
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
          <label className="block text-sm font-medium text-muted-foreground">Dividir</label>
          <div className="mt-1 flex gap-2">
            {(['EQUAL', 'AMOUNT', 'PERCENTAGE'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSplitType(t)}
                className={`flex-1 rounded-lg py-2 text-sm ${splitType === t ? 'bg-primary text-primary-foreground' : 'border border-input text-muted-foreground'}`}
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
                    className="w-24 rounded-lg border border-input bg-card px-2 py-1 text-right text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
              <p
                className={`text-xs ${amountSumCents === totalCents ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
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
                      className="w-20 rounded-lg border border-input bg-card px-2 py-1 text-right text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
              <p
                className={`text-xs ${Math.abs(percentSum - 100) < 0.01 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
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
          className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-50"
        >
          {isSaving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar gasto'}
        </button>
      </form>
    </main>
  );
}

// ─── Outer loader ─────────────────────────────────────────────────────────────

export function ExpenseForm() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const isEdit = !!expenseId;
  const trpc = useTRPC();

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
      <main className="p-6">
        <ErrorState message={group.error.message} onRetry={() => group.refetch()} />
      </main>
    );
  }
  if (isEdit && expense.isError) {
    return (
      <main className="p-6">
        <ErrorState message={expense.error.message} onRetry={() => expense.refetch()} />
      </main>
    );
  }

  return (
    <ExpenseFormBody
      groupId={groupId!}
      group={group.data}
      expenseId={expenseId}
      expense={isEdit ? expense.data : undefined}
    />
  );
}
