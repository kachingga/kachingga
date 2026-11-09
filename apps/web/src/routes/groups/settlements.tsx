import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';
import { currencies } from '@kachingga/api/schemas';
import { ExchangeRateFields } from '@/components/exchange-rate-fields';
import { NumberInput } from '@/components/number-input';
import { useExchangeRate } from '@/lib/use-exchange-rate';
import { ArchivedNotice } from '@/components/archived-notice';
import { ErrorState } from '@/components/error-state';
import { Card, Field, Page, PageHeader } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { ListScreenSkeleton, RowsSkeleton } from '@/components/skeletons';
import { useTRPC } from '@/lib/trpc';
import { buildSettlement, byDateDesc, isTemp } from '@/lib/optimistic';
import { useConfirm } from '@/lib/use-confirm';
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

  if (group.isPending) return <ListScreenSkeleton />;
  if (group.isError) {
    return (
      <div className="p-6 text-center">
        <ErrorState message={group.error.message} onRetry={() => group.refetch()} />
        <Button variant="link" className="mt-2 text-muted-foreground" onClick={() => navigate(-1)}>
          Volver
        </Button>
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
  const confirm = useConfirm();

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

  // Optimistic: the payment shows up in the list right away and the form closes. If the API
  // rejects it, it's taken out and the form opens again with what was entered.
  const listKey = trpc.settlements.list.queryKey({ groupId });
  const refresh = () => {
    void queryClient.invalidateQueries(trpc.settlements.pathFilter());
    void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId }));
  };

  const createSettlement = useMutation(
    trpc.settlements.create.mutationOptions({
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData(listKey);
        queryClient.setQueryData(listKey, (old) =>
          byDateDesc([buildSettlement(input, group), ...(old ?? [])]),
        );
        setShowForm(false);
        return { previous };
      },
      onSuccess: () => {
        setFromId('');
        setToId('');
        setAmountInput('');
        setNote('');
      },
      onError: (err, _input, context) => {
        if (context) queryClient.setQueryData(listKey, context.previous);
        setShowForm(true);
        setFormError(err.message);
        toast.error(`No se registró el pago: ${err.message}`);
      },
      onSettled: refresh,
    }),
  );

  const deleteSettlement = useMutation(
    trpc.settlements.delete.mutationOptions({
      onMutate: async ({ settlementId }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData(listKey);
        queryClient.setQueryData(listKey, (old) => old?.filter((s) => s.id !== settlementId));
        return { previous };
      },
      onError: (err, _input, context) => {
        if (context) queryClient.setQueryData(listKey, context.previous);
        toast.error(`No se borró el pago: ${err.message}`);
      },
      onSettled: refresh,
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
    if (fromId === toId) {
      setFormError('Tiene que ser entre dos personas distintas');
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
    <Page>
      <PageHeader title="Pagos" back={{ onClick: () => navigate(-1), label: 'Volver' }} />

      {isArchived && <ArchivedNotice groupId={group.id} />}

      {/* Registrar pago */}
      {!isArchived && (
        <div>
          {!showForm ? (
            <Button size="lg" className="w-full" onClick={() => setShowForm(true)}>
              <Plus />
              Registrar pago
            </Button>
          ) : (
            <Card>
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="font-semibold">Registrar pago</h2>

                <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
                  <Field label="Quién pagó" htmlFor="from">
                    <NativeSelect
                      id="from"
                      value={fromId}
                      onChange={(e) => setFromId(e.target.value)}
                      required
                    >
                      <option value="">Elegir…</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.isMe ? ' (yo)' : ''}
                        </option>
                      ))}
                    </NativeSelect>{' '}
                  </Field>

                  <Field label="A quién" htmlFor="to">
                    <NativeSelect
                      id="to"
                      value={toId}
                      onChange={(e) => setToId(e.target.value)}
                      required
                    >
                      <option value="">Elegir…</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.isMe ? ' (yo)' : ''}
                        </option>
                      ))}
                    </NativeSelect>{' '}
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
                  <Field label="Monto" htmlFor="amount">
                    <NumberInput
                      id="amount"
                      value={amountInput}
                      onValueChange={setAmountInput}
                      required
                      placeholder="0"
                    />{' '}
                  </Field>

                  <Field label="Moneda" htmlFor="sett-currency">
                    <NativeSelect
                      id="sett-currency"
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
                    </NativeSelect>{' '}
                  </Field>
                </div>

                <ExchangeRateFields rate={rate} amountCents={toCents(amountInput)} />

                <Field label="Fecha" htmlFor="sett-date">
                  <Input
                    id="sett-date"
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    required
                  />{' '}
                </Field>

                <Field label="Nota (opcional)" htmlFor="note">
                  <Input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Transferencia del 5/12"
                  />{' '}
                </Field>

                {formError && <p className="text-sm text-destructive">{formError}</p>}

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" loading={createSettlement.isPending}>
                    {createSettlement.isPending ? 'Guardando…' : 'Registrar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowForm(false);
                      setFormError(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}

      {/* Lista de pagos */}
      {settlements.isPending && <RowsSkeleton />}
      {settlements.isError && (
        <ErrorState message={settlements.error.message} onRetry={() => settlements.refetch()} />
      )}

      {settlements.isSuccess && settlements.data.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Todavía no hay pagos registrados.
        </p>
      )}

      {settlements.isSuccess && settlements.data.length > 0 && (
        <ul className="space-y-2">
          {settlements.data.map((s) => (
            <li
              key={s.id}
              aria-busy={isTemp(s.id) || undefined}
              className={`flex items-center justify-between rounded-2xl border bg-card p-4 shadow-soft ${isTemp(s.id) ? 'opacity-60' : ''}`}
            >
              <div>
                <p className="text-sm font-medium">
                  {s.from.name} → {s.to.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCents(s.amountCents, s.currency)} · {formatDate(s.date)}
                  {s.note ? ` · ${s.note}` : ''}
                </p>
              </div>
              {!isArchived && !isTemp(s.id) && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="ml-2 text-destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: '¿Borrar este pago?',
                      description: 'Deja de contar en los saldos.',
                      confirmLabel: 'Borrar',
                      destructive: true,
                    });
                    if (ok) deleteSettlement.mutate({ settlementId: s.id });
                  }}
                >
                  Borrar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
