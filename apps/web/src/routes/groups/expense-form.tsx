import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';
import { currencies, expenseCategories } from '@kachingga/api/schemas';

import { useTRPC } from '@/lib/trpc';
import {
  categoryLabels,
  centsToDisplay,
  currencyLabels,
  formatCents,
  parseCents,
  toDateInput,
  todayInput,
  type Currency,
  type ExpenseCategory,
} from '@/lib/format';

type GroupData = inferRouterOutputs<AppRouter>['groups']['get'];
type ExpenseData = inferRouterOutputs<AppRouter>['expenses']['get'];
type RateSource = 'blue' | 'oficial' | 'manual';

// Whether auto-suggest is possible: exactly one of (base, expense) currencies is ARS.
function canAutoSuggest(base: string, expense: string) {
  return (base === 'ARS') !== (expense === 'ARS') && base !== expense;
}

function defaultRateSource(base: string, expCurrency: string): RateSource {
  if (base === expCurrency) return 'manual';
  const foreign = base === 'ARS' ? expCurrency : base;
  return foreign === 'USD' ? 'blue' : 'oficial';
}

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
  const initKeep = !!expense && expense.currency !== base && expense.exchangeRate === null;
  const initRateSource: RateSource =
    expense?.exchangeRate != null ? 'manual' : defaultRateSource(base, initCurrency);

  // Form state
  const [description, setDescription] = useState(expense?.description ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(
    (expense?.category as ExpenseCategory) ?? 'OTHER',
  );
  const [dateInput, setDateInput] = useState(expense ? toDateInput(expense.date) : todayInput());
  const [amountInput, setAmountInput] = useState(
    expense ? centsToDisplay(expense.amountCents) : '',
  );
  const [currency, setCurrency] = useState<Currency>(initCurrency);
  const [paidById, setPaidById] = useState(expense?.paidById ?? group.myParticipantId);
  const [keepCurrency, setKeepCurrency] = useState(initKeep);
  const [rateSource, setRateSource] = useState<RateSource>(initRateSource);
  const [manualRate, setManualRate] = useState(
    expense?.exchangeRate != null ? String(expense.exchangeRate) : '',
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
        expense.splits.map((s) => [s.participantId, centsToDisplay(s.amountCents)]),
      );
    }
    return Object.fromEntries(allIds.map((id) => [id, '']));
  });
  const [percentShares, setPercentShares] = useState<Record<string, string>>(() => {
    if (expense?.splitType === 'PERCENTAGE') {
      return Object.fromEntries(
        expense.splits.map((s) => [s.participantId, String(s.percentage ?? 0)]),
      );
    }
    return Object.fromEntries(allIds.map((id) => [id, '']));
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Exchange rate query (auto-suggest)
  const shouldFetchRate =
    currency !== base && !keepCurrency && canAutoSuggest(base, currency) && rateSource !== 'manual';
  const fetchCurrency = (base === 'ARS' ? currency : base) as Exclude<Currency, 'ARS'>;
  const fetchSource = rateSource === 'blue' ? 'blue' : 'oficial';

  const rateQuery = useQuery({
    ...trpc.rates.get.queryOptions({ currency: fetchCurrency, source: fetchSource }),
    enabled: shouldFetchRate,
  });

  // Compute the rate to display (and send to API)
  function getDisplayRate(): string {
    if (rateSource === 'manual') return manualRate;
    if (!rateQuery.data) return '';
    const mid = rateQuery.data.mid;
    return (base === 'ARS' ? mid : 1 / mid).toFixed(4);
  }

  const displayRate = getDisplayRate();

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
      return { type: 'EQUAL' as const, participantIds: equalIds };
    }
    if (splitType === 'AMOUNT') {
      return {
        type: 'AMOUNT' as const,
        shares: Object.entries(amountShares)
          .filter(([, v]) => parseCents(v) > 0)
          .map(([participantId, v]) => ({ participantId, amountCents: parseCents(v) })),
      };
    }
    return {
      type: 'PERCENTAGE' as const,
      shares: Object.entries(percentShares)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([participantId, v]) => ({ participantId, percentage: parseFloat(v) })),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const amountCents = parseCents(amountInput);
    if (amountCents <= 0) {
      setFormError('El monto tiene que ser mayor a cero');
      return;
    }

    const exchangeRateValue =
      currency === base
        ? undefined
        : keepCurrency
          ? undefined
          : displayRate
            ? parseFloat(displayRate)
            : undefined;

    const common = {
      description,
      category,
      date: new Date(dateInput + 'T12:00:00'),
      amountCents,
      currency,
      exchangeRate: exchangeRateValue ?? null,
      keepCurrency,
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
  const amountSumCents = Object.values(amountShares).reduce((s, v) => s + parseCents(v), 0);
  const percentSum = Object.values(percentShares).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const totalCents = parseCents(amountInput);

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6 pb-12">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-neutral-400">
          ←
        </button>
        <h1 className="text-xl font-bold">{isEdit ? 'Editar gasto' : 'Agregar gasto'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Monto */}
        <div>
          <label className="block text-sm font-medium text-neutral-400" htmlFor="amount">
            Monto
          </label>
          <input
            id="amount"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            required
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-neutral-400" htmlFor="description">
            Descripción
          </label>
          <input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Cena"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          />
        </div>

        {/* Categoría y fecha */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-neutral-400" htmlFor="category">
              Categoría
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
            >
              {expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400" htmlFor="date">
              Fecha
            </label>
            <input
              id="date"
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>
        </div>

        {/* Quién pagó */}
        <div>
          <label className="block text-sm font-medium text-neutral-400" htmlFor="paidBy">
            Quién pagó
          </label>
          <select
            id="paidBy"
            value={paidById}
            onChange={(e) => setPaidById(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
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
          <label className="block text-sm font-medium text-neutral-400" htmlFor="currency">
            Moneda
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => {
              const c = e.target.value as Currency;
              setCurrency(c);
              setKeepCurrency(false);
              setRateSource(defaultRateSource(base, c));
              setManualRate('');
            }}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {currencyLabels[c]}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de cambio (si la moneda no es la base) */}
        {currency !== base && (
          <div className="space-y-3 rounded-2xl bg-neutral-900 p-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKeepCurrency(false)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${!keepCurrency ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-400'}`}
              >
                Convertir a {base}
              </button>
              <button
                type="button"
                onClick={() => setKeepCurrency(true)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${keepCurrency ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-400'}`}
              >
                Mantener en {currency}
              </button>
            </div>

            {!keepCurrency && (
              <>
                {/* Selector de fuente del tipo de cambio */}
                {canAutoSuggest(base, currency) && (
                  <div className="flex gap-2">
                    {currency === 'USD' || base === 'USD' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setRateSource('blue')}
                          className={`rounded-lg px-3 py-1 text-xs ${rateSource === 'blue' ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-400'}`}
                        >
                          Blue
                        </button>
                        <button
                          type="button"
                          onClick={() => setRateSource('oficial')}
                          className={`rounded-lg px-3 py-1 text-xs ${rateSource === 'oficial' ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-400'}`}
                        >
                          Oficial
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setRateSource('manual');
                        setManualRate(displayRate);
                      }}
                      className={`rounded-lg px-3 py-1 text-xs ${rateSource === 'manual' ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-400'}`}
                    >
                      A mano
                    </button>
                  </div>
                )}

                {/* Campo de tipo de cambio */}
                <div>
                  <label className="block text-xs text-neutral-500">
                    1 {base === 'ARS' ? currency : base} ={' '}
                    {rateQuery.isPending && rateSource !== 'manual' ? 'cargando…' : ''}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      value={rateSource === 'manual' ? manualRate : displayRate}
                      onChange={(e) => {
                        if (rateSource === 'manual') setManualRate(e.target.value);
                      }}
                      readOnly={rateSource !== 'manual'}
                      inputMode="decimal"
                      placeholder="0.00"
                      className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                    />
                    <span className="text-sm text-neutral-400">
                      {base === 'ARS' ? base : 'ARS'}
                    </span>
                  </div>
                  {displayRate && !keepCurrency && totalCents > 0 && (
                    <p className="mt-1 text-xs text-neutral-400">
                      ≈ {formatCents(Math.round(totalCents * parseFloat(displayRate)), base)}
                    </p>
                  )}
                  {rateQuery.isError && (
                    <p className="mt-1 text-xs text-red-400">
                      No se pudo cargar la cotización. Usá &quot;A mano&quot;.
                    </p>
                  )}
                </div>
              </>
            )}

            {!canAutoSuggest(base, currency) && !keepCurrency && (
              <div>
                <label className="block text-xs text-neutral-500">
                  Tipo de cambio (1 {currency} en {base})
                </label>
                <input
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  required
                  inputMode="decimal"
                  placeholder="0.00"
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>
            )}
          </div>
        )}

        {/* División */}
        <div>
          <label className="block text-sm font-medium text-neutral-400">Dividir</label>
          <div className="mt-1 flex gap-2">
            {(['EQUAL', 'AMOUNT', 'PERCENTAGE'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSplitType(t)}
                className={`flex-1 rounded-lg py-2 text-sm ${splitType === t ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-400'}`}
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
                  {equalIds.includes(p.id) && totalCents > 0 && equalIds.length > 0 && (
                    <span className="ml-auto text-xs text-neutral-400">
                      {formatCents(Math.round(totalCents / equalIds.length), currency)}
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
                  <input
                    value={amountShares[p.id] ?? ''}
                    onChange={(e) => setAmountShares({ ...amountShares, [p.id]: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-24 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  />
                </div>
              ))}
              <p
                className={`text-xs ${amountSumCents === totalCents ? 'text-green-400' : 'text-neutral-400'}`}
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
                    <input
                      value={percentShares[p.id] ?? ''}
                      onChange={(e) =>
                        setPercentShares({ ...percentShares, [p.id]: e.target.value })
                      }
                      inputMode="decimal"
                      placeholder="0"
                      className="w-20 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                    />
                    <span className="text-sm text-neutral-400">%</span>
                  </div>
                </div>
              ))}
              <p
                className={`text-xs ${Math.abs(percentSum - 100) < 0.01 ? 'text-green-400' : 'text-neutral-400'}`}
              >
                Total: {percentSum.toFixed(1)}% / 100%
                {Math.abs(percentSum - 100) >= 0.01 &&
                  ` (faltan ${(100 - percentSum).toFixed(1)}%)`}
              </p>
            </div>
          )}
        </div>

        {formError && <p className="text-sm text-red-400">{formError}</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="w-full rounded-lg bg-white py-3 font-medium text-black disabled:opacity-50"
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
    return <p className="p-6 text-center text-neutral-400">Cargando…</p>;
  }
  if (group.isError) return <p className="p-6 text-red-400">{group.error.message}</p>;
  if (isEdit && expense.isError) return <p className="p-6 text-red-400">{expense.error.message}</p>;

  return (
    <ExpenseFormBody
      groupId={groupId!}
      group={group.data}
      expenseId={expenseId}
      expense={isEdit ? expense.data : undefined}
    />
  );
}
