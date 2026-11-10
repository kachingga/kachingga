import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';
import { currencies, distributeCents } from '@kachingga/api/schemas';

import { ExchangeRateFields } from '@/components/exchange-rate-fields';
import { NumberInput } from '@/components/number-input';
import { useExchangeRate } from '@/lib/use-exchange-rate';
import { ArchivedNotice } from '@/components/archived-notice';
import { CategoryPicker } from '@/components/category-picker';
import { ErrorState } from '@/components/error-state';
import { Card, Chip, Field, Page, PageHeader } from '@/components/kit';
import { FormSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useTRPC } from '@/lib/trpc';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useGoBack } from '@/lib/use-go-back';
import { buildExpense, byDateDesc, tempId, type Expense } from '@/lib/optimistic';
import {
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
} from '@/lib/format';

type GroupData = inferRouterOutputs<AppRouter>['groups']['get'];
type ExpenseData = inferRouterOutputs<AppRouter>['expenses']['get'];

// ─── Inner form (renders only when group + optional expense are ready) ────────

/** How long after the last keystroke the category is suggested. */
const SUGGEST_DELAY_MS = 400;

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
  // The group's categories: the active ones can be picked; an archived one only if the expense
  // already had it. '' = not picked yet → the one the API suggests for the description, else the
  // group's "Otros". A category picked by hand is never replaced.
  const categories = useQuery(trpc.categories.list.queryOptions({ groupId }));
  const [pickedCategoryId, setCategoryId] = useState(expense?.categoryId ?? '');
  const categoryOptions = (categories.data ?? []).filter(
    (c) => !c.archived || c.id === expense?.categoryId,
  );
  const typed = description.trim();
  const debouncedDescription = useDebouncedValue(typed, SUGGEST_DELAY_MS);
  const wantsSuggestion = !pickedCategoryId && typed.length >= 2;
  const suggestion = useQuery({
    ...trpc.categories.suggest.queryOptions({ groupId, description: debouncedDescription }),
    enabled: wantsSuggestion && debouncedDescription.length >= 2,
    // Keeps the last suggestion while the next one loads (no flicker back to "Otros").
    placeholderData: keepPreviousData,
    // One entry per description typed: dropped soon so they don't pile up in the offline cache.
    gcTime: 60_000,
    retry: false,
  });
  const suggestedId = wantsSuggestion ? suggestion.data?.categoryId : undefined;
  const suggestedCategory = categoryOptions.find((c) => c.id === suggestedId);
  const categoryId =
    pickedCategoryId ||
    suggestedCategory?.id ||
    categoryOptions.find((c) => c.defaultKey === 'OTHER')?.id ||
    '';
  const selectedCategory = categoryOptions.find((c) => c.id === categoryId);
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
        const draft = buildExpense(input, group, tempId(), undefined, selectedCategory);
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
        const draft = buildExpense({ ...input }, group, id, expense, selectedCategory);
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
      categoryId: categoryId || undefined,
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
    <Page>
      <PageHeader
        title={isEdit ? 'Editar gasto' : 'Agregar gasto'}
        back={{ onClick: () => navigate(-1), label: 'Volver' }}
      />

      <Card className="rise">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Monto" htmlFor="amount">
            <NumberInput
              id="amount"
              value={amountInput}
              onValueChange={setAmountInput}
              required
              placeholder="0"
              className="h-14 font-display text-3xl font-bold tabular"
            />
          </Field>

          <Field label="Descripción" htmlFor="description">
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Cena"
            />
          </Field>

          {/* Categoría */}
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p
                className="flex items-center gap-2 text-sm font-medium text-foreground"
                id="category-label"
              >
                Categoría
                {suggestedCategory && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    <Sparkles className="size-3" aria-hidden />
                    Sugerida
                  </span>
                )}
              </p>
              <Link
                to={`/grupos/${groupId}/categorias`}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Editar categorías
              </Link>
            </div>
            <div className="mt-1.5">
              {categories.isPending ? (
                <div className="h-10 animate-pulse rounded-xl bg-muted" />
              ) : (
                <CategoryPicker
                  categories={categoryOptions}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              )}
            </div>
          </div>

          {/* Fecha y quién pagó, juntos (como el diseño) */}
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <Field label="Fecha" htmlFor="date">
              <Input
                id="date"
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                required
              />
            </Field>
            <Field label="Quién pagó" htmlFor="paidBy">
              <NativeSelect
                id="paidBy"
                value={paidById}
                onChange={(e) => setPaidById(e.target.value)}
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isMe ? ' (yo)' : ''}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field label="Moneda" htmlFor="currency">
            <NativeSelect
              id="currency"
              value={currency}
              onChange={(e) => {
                const c = e.target.value as Currency;
                setCurrency(c);
                rate.resetFor(c);
              }}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {currencyLabels[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <ExchangeRateFields rate={rate} amountCents={totalCents} />

          {/* División */}
          <div>
            <Label id="split-label">Dividir</Label>
            <div className="mt-1.5 flex gap-2" role="group" aria-labelledby="split-label">
              {(['EQUAL', 'AMOUNT', 'PERCENTAGE'] as const).map((t) => (
                <Chip
                  key={t}
                  active={splitType === t}
                  onClick={() => setSplitType(t)}
                  className="flex-1"
                >
                  {t === 'EQUAL' ? 'Igual' : t === 'AMOUNT' ? 'Por monto' : 'Por %'}
                </Chip>
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
                      className="w-28 text-right"
                    />
                  </div>
                ))}
                <p
                  className={`text-xs ${amountSumCents === totalCents ? 'text-positive' : 'text-muted-foreground'}`}
                >
                  Suma: {formatCents(amountSumCents, currency)} /{' '}
                  {formatCents(totalCents, currency)}
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
                        className="w-24 text-right"
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

          <Button type="submit" size="lg" className="w-full" loading={isSaving}>
            {isSaving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar gasto'}
          </Button>
        </form>
      </Card>
    </Page>
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
      <Page>
        <ArchivedNotice groupId={groupId!} />
        <Button variant="link" className="text-muted-foreground" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </Page>
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
