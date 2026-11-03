import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { currencies } from '@kachingga/api/schemas';
import { useTRPC } from '@/lib/trpc';
import {
  centsToDisplay,
  currencyLabels,
  formatCents,
  formatDate,
  parseCents,
  todayInput,
  type Currency,
} from '@/lib/format';

export function Settlements() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));
  const settlements = useQuery(trpc.settlements.list.queryOptions({ groupId: groupId! }));

  // Pre-fill from query params (e.g. from "Marcar como pagado" on group detail)
  const prefillFrom = searchParams.get('from') ?? '';
  const prefillTo = searchParams.get('to') ?? '';
  const prefillAmountCents = searchParams.get('amount') ? Number(searchParams.get('amount')) : 0;
  const prefillCurrency = searchParams.get('currency') ?? '';

  const baseCurrency = (group.data?.baseCurrency ?? 'ARS') as Currency;

  const [fromId, setFromId] = useState(prefillFrom);
  const [toId, setToId] = useState(prefillTo);
  const [amountInput, setAmountInput] = useState(
    prefillAmountCents > 0 ? centsToDisplay(prefillAmountCents) : '',
  );
  const [currency, setCurrency] = useState<Currency>((prefillCurrency as Currency) || baseCurrency);
  const [keepCurrency, setKeepCurrency] = useState(false);
  const [exchangeRateInput, setExchangeRateInput] = useState('');
  const [dateInput, setDateInput] = useState(todayInput());
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!!prefillFrom);

  const createSettlement = useMutation(
    trpc.settlements.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.settlements.pathFilter());
        void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId: groupId! }));
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
        void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId: groupId! }));
      },
    }),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const amountCents = parseCents(amountInput);
    if (amountCents <= 0) {
      setFormError('El monto tiene que ser mayor a cero');
      return;
    }
    if (!fromId || !toId) {
      setFormError('Completá quién pagó y a quién');
      return;
    }
    createSettlement.mutate({
      groupId: groupId!,
      fromId,
      toId,
      amountCents,
      currency,
      exchangeRate:
        currency !== baseCurrency && !keepCurrency && exchangeRateInput
          ? parseFloat(exchangeRateInput)
          : null,
      keepCurrency: keepCurrency,
      date: new Date(dateInput + 'T12:00:00'),
      note: note.trim() || null,
    });
  }

  const participants = group.data?.participants ?? [];
  const isArchived = !!group.data?.archivedAt;

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
                  <input
                    id="amount"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    required
                    inputMode="decimal"
                    placeholder="0.00"
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
                    onChange={(e) => setCurrency(e.target.value as Currency)}
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

              {currency !== baseCurrency && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setKeepCurrency(false)}
                      className={`flex-1 rounded-lg py-1 text-sm ${!keepCurrency ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-400'}`}
                    >
                      Convertir
                    </button>
                    <button
                      type="button"
                      onClick={() => setKeepCurrency(true)}
                      className={`flex-1 rounded-lg py-1 text-sm ${keepCurrency ? 'bg-white text-black' : 'border border-neutral-700 text-neutral-400'}`}
                    >
                      Mantener
                    </button>
                  </div>
                  {!keepCurrency && (
                    <div>
                      <label className="block text-xs text-neutral-500">
                        Tipo de cambio (1 {currency} en {baseCurrency})
                      </label>
                      <input
                        value={exchangeRateInput}
                        onChange={(e) => setExchangeRateInput(e.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                      />
                    </div>
                  )}
                </div>
              )}

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
      {settlements.isPending && <p className="text-center text-neutral-400">Cargando…</p>}
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
