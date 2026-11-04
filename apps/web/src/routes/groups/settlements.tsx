import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';
import { currencies } from '@kachingga/api/schemas';
import { ExchangeRateFields } from '@/components/exchange-rate-fields';
import { NumberInput } from '@/components/number-input';
import { useExchangeRate } from '@/lib/use-exchange-rate';
import { Spinner } from '@/components/spinner';
import { useTRPC } from '@/lib/trpc';
import {
  centsToNumeric,
  currencyLabels,
  dayToDate,
  formatCents,
  formatDate,
  toCents,
  today,
  type Currency,
} from '@/lib/format';

type GroupData = inferRouterOutputs<AppRouter>['groups']['get'];

export function Settlements() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const trpc = useTRPC();

  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));

  if (group.isPending) return <Spinner fullScreen />;
  if (group.isError) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">{group.error.message}</p>
        <button onClick={() => navigate(-1)} className="mt-2 text-sm text-neutral-400 underline">
          Volver
        </button>
      </div>
    );
  }
  return <SettlementsBody groupId={groupId!} group={group.data} />;
}

function SettlementsBody({ groupId, group }: { groupId: string; group: GroupData }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const settlements = useQuery(trpc.settlements.list.queryOptions({ groupId }));

  const baseCurrency = group.baseCurrency as Currency;

  // Pre-fill from query params (e.g. from "Marcar como pagado" on group detail)
  const prefillFrom = searchParams.get('from') ?? '';
  const prefillTo = searchParams.get('to') ?? '';
  const prefillAmountCents = searchParams.get('amount') ? Number(searchParams.get('amount')) : 0;
  const prefillCurrency = (currencies as readonly string[]).includes(
    searchParams.get('currency') ?? '',
  )
    ? (searchParams.get('currency') as Currency)
    : baseCurrency;

  const [fromId, setFromId] = useState(prefillFrom);
  const [toId, setToId] = useState(prefillTo);
  const [amountInput, setAmountInput] = useState(
    prefillAmountCents > 0 ? centsToNumeric(prefillAmountCents) : '',
  );
  const [currency, setCurrency] = useState<Currency>(prefillCurrency);
  // A suggested transfer in a currency other than the base settles that currency's own balance.
  const rate = useExchangeRate(baseCurrency, currency, {
    exchangeRate: null,
    keepCurrency: prefillCurrency !== baseCurrency,
  });
  const [dateInput, setDateInput] = useState(today());
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!!prefillFrom);

  const createSettlement = useMutation(
    trpc.settlements.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.settlements.pathFilter());
        void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId }));
        setShowForm(false);
        setFormError(null);
        setFromId('');
        setToId('');
        setAmountInput('');
        setNote('');
      },
      onError: (err) => setFormError(err.message),
    }),
  );

  const deleteSettlement = useMutation(
    trpc.settlements.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.settlements.pathFilter());
        void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId }));
      },
    }),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const amountCents = toCents(amountInput);
    if (amountCents <= 0) {
      setFormError('El monto tiene que ser mayor a cero');
      return;
    }
    if (!fromId || !toId) {
      setFormError('Completá quién pagó y a quién');
      return;
    }
    if (rate.missingRateError) {
      setFormError(rate.missingRateError);
      return;
    }
    createSettlement.mutate({
      groupId,
      fromId,
      toId,
      amountCents,
      currency,
      exchangeRate: rate.exchangeRate,
      keepCurrency: currency !== baseCurrency && rate.keepCurrency,
      date: dayToDate(dateInput),
      note: note.trim() || null,
    });
  }

  const participants = group.participants;
  const isArchived = !!group.archivedAt;

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-neutral-400">
          ←
        </button>
        <h1 className="text-xl font-bold">Pagos</h1>
      </div>

      {/* Registrar pago */}
      {!isArchived && (
        <div className="mb-6">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-xl bg-white py-3 font-medium text-black"
            >
              + Registrar pago
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-neutral-900 p-4">
              <h2 className="font-semibold">Registrar pago</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-400" htmlFor="from">
                    Quién pagó
                  </label>
                  <select
                    id="from"
                    value={fromId}
                    onChange={(e) => setFromId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  >
                    <option value="">Elegir…</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.isMe ? ' (yo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400" htmlFor="to">
                    A quién
                  </label>
                  <select
                    id="to"
                    value={toId}
                    onChange={(e) => setToId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  >
                    <option value="">Elegir…</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.isMe ? ' (yo)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-400" htmlFor="amount">
                    Monto
                  </label>
                  <NumberInput
                    id="amount"
                    value={amountInput}
                    onValueChange={setAmountInput}
                    required
                    placeholder="0"
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-neutral-400"
                    htmlFor="sett-currency"
                  >
                    Moneda
                  </label>
                  <select
                    id="sett-currency"
                    value={currency}
                    onChange={(e) => {
                      const c = e.target.value as Currency;
                      setCurrency(c);
                      rate.resetFor(c);
                    }}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
                  >
                    {currencies.map((c) => (
                      <option key={c} value={c}>
                        {currencyLabels[c]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ExchangeRateFields rate={rate} amountCents={toCents(amountInput)} />

              <div>
                <label className="block text-sm font-medium text-neutral-400" htmlFor="sett-date">
                  Fecha
                </label>
                <input
                  id="sett-date"
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-base text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400" htmlFor="note">
                  Nota (opcional)
                </label>
                <input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Transferencia del 5/12"
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              </div>

              {formError && <p className="text-sm text-red-400">{formError}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createSettlement.isPending}
                  className="flex-1 rounded-lg bg-white py-2 font-medium text-black disabled:opacity-50"
                >
                  {createSettlement.isPending ? 'Guardando…' : 'Registrar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                  className="flex-1 rounded-lg border border-neutral-700 py-2 text-neutral-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Lista de pagos */}
      {settlements.isPending && <Spinner />}
      {settlements.isError && (
        <p className="text-center text-red-400">{settlements.error.message}</p>
      )}

      {settlements.isSuccess && settlements.data.length === 0 && (
        <p className="py-8 text-center text-sm text-neutral-400">
          Todavía no hay pagos registrados.
        </p>
      )}

      {settlements.isSuccess && settlements.data.length > 0 && (
        <ul className="space-y-2">
          {settlements.data.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-2xl bg-neutral-900 p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {s.from.name} → {s.to.name}
                </p>
                <p className="text-xs text-neutral-400">
                  {formatCents(s.amountCents, s.currency)} · {formatDate(s.date)}
                  {s.note ? ` · ${s.note}` : ''}
                </p>
              </div>
              {!isArchived && (
                <button
                  onClick={() => {
                    if (confirm('¿Borrar este pago?'))
                      deleteSettlement.mutate({ settlementId: s.id });
                  }}
                  className="ml-2 text-xs text-red-400"
                >
                  Borrar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
