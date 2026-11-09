import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { expenseCategories } from '@kachingga/api/schemas';
import { ErrorState } from '@/components/error-state';
import { LoadMore } from '@/components/load-more';
import { NumberInput } from '@/components/number-input';
import { ExpenseListSkeleton } from '@/components/skeletons';
import { useTRPC } from '@/lib/trpc';
import { categoryLabels, formatCents, formatDate, monthRange, today } from '@/lib/format';
import {
  fromApiFilters,
  readUrlFilters,
  toApiFilters,
  writeUrlFilters,
  type UrlFilters,
} from '@/lib/url-filters';

function triggerDownload(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-input bg-muted px-2 py-1 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:text-sm';

export function Filters() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // The filters live in the URL (src/lib/url-filters.ts): they survive opening an expense and
  // coming back. Typing replaces the history entry instead of adding one per keystroke.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = readUrlFilters(searchParams);
  const filters = toApiFilters(urlFilters);
  const setFilters = (next: UrlFilters) =>
    setSearchParams(writeUrlFilters(next), { replace: true });
  const update = (changes: Partial<UrlFilters>) => setFilters({ ...urlFilters, ...changes });

  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));
  const savedFilters = useQuery(trpc.savedFilters.list.queryOptions({ groupId: groupId! }));

  const [filterName, setFilterName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);

  const myId = group.data?.myParticipantId;
  const participants = group.data?.participants ?? [];

  const summary = useQuery(trpc.expenses.summary.queryOptions({ groupId: groupId!, filters }));
  const expenses = useInfiniteQuery(
    trpc.expenses.list.infiniteQueryOptions(
      { groupId: groupId!, filters },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );

  const csvExport = useQuery({
    ...trpc.expenses.export.queryOptions({ groupId: groupId!, filters, format: 'csv' }),
    enabled: false,
  });
  const jsonExport = useQuery({
    ...trpc.expenses.export.queryOptions({ groupId: groupId!, filters, format: 'json' }),
    enabled: false,
  });

  async function handleExport(format: 'csv' | 'json') {
    const setExporting = format === 'csv' ? setExportingCsv : setExportingJson;
    setExporting(true);
    try {
      const result = await (format === 'csv' ? csvExport : jsonExport).refetch();
      if (result.data) {
        triggerDownload(result.data.filename, result.data.mimeType, result.data.content);
      }
    } finally {
      setExporting(false);
    }
  }

  const createFilter = useMutation(
    trpc.savedFilters.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.savedFilters.pathFilter());
        setFilterName('');
        setSaveError(null);
      },
      onError: (e) => setSaveError(e.message),
    }),
  );
  const deleteFilter = useMutation(
    trpc.savedFilters.delete.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries(trpc.savedFilters.pathFilter()),
    }),
  );

  function applyMonth(month: string) {
    if (!month) return update({ dateFrom: undefined, dateTo: undefined });
    const { from, to } = monthRange(`${month}-01`);
    update({ dateFrom: from, dateTo: to });
  }

  // The month picker shows a month only while the dates are exactly that month.
  const selectedMonth =
    urlFilters.dateFrom &&
    urlFilters.dateTo &&
    monthRange(urlFilters.dateFrom).from === urlFilters.dateFrom &&
    monthRange(urlFilters.dateFrom).to === urlFilters.dateTo
      ? urlFilters.dateFrom.slice(0, 7)
      : '';

  const allExpenses = expenses.data?.pages.flatMap((p) => p.items) ?? [];
  const loadMoreExpenses = () => void expenses.fetchNextPage();

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-muted-foreground">
          ←
        </button>
        <h1 className="text-xl font-bold">Filtros y totales</h1>
      </div>

      {/* Atajos */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => myId && update({ involvedParticipantId: myId })}
          className="rounded-full border border-input px-3 py-1 text-sm text-foreground"
        >
          Mis gastos
        </button>
        <button
          onClick={() => applyMonth(today().slice(0, 7))}
          className="rounded-full border border-input px-3 py-1 text-sm text-foreground"
        >
          Este mes
        </button>
        <button
          onClick={() => setFilters({})}
          className="rounded-full border border-input px-3 py-1 text-sm text-muted-foreground"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Filtros guardados */}
      {savedFilters.isSuccess && savedFilters.data.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {savedFilters.data.map((sf) => (
            <div
              key={sf.id}
              className="flex items-center gap-1 rounded-full border border-input py-1 pl-3 pr-1"
            >
              <button onClick={() => setFilters(fromApiFilters(sf.filters))} className="text-sm">
                {sf.name}
              </button>
              <button
                onClick={() => deleteFilter.mutate({ savedFilterId: sf.id })}
                aria-label={`Borrar filtro ${sf.name}`}
                className="px-1 text-xs text-muted-foreground"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de filtros */}
      <div className="mb-6 space-y-3 rounded-2xl bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="f-paid" className="block text-xs text-muted-foreground">
              Quién pagó
            </label>
            <select
              id="f-paid"
              value={urlFilters.paidById ?? ''}
              onChange={(e) => update({ paidById: e.target.value || undefined })}
              className={fieldClass}
            >
              <option value="">Todos</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-split" className="block text-xs text-muted-foreground">
              Le corresponde a
            </label>
            <select
              id="f-split"
              value={urlFilters.splitParticipantId ?? ''}
              onChange={(e) => update({ splitParticipantId: e.target.value || undefined })}
              className={fieldClass}
            >
              <option value="">Todos</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="f-involved" className="block text-xs text-muted-foreground">
            Involucrado (pagó o le corresponde)
          </label>
          <select
            id="f-involved"
            value={urlFilters.involvedParticipantId ?? ''}
            onChange={(e) => update({ involvedParticipantId: e.target.value || undefined })}
            className={fieldClass}
          >
            <option value="">Todos</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="f-month" className="block text-xs text-muted-foreground">
            Mes
          </label>
          <input
            id="f-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => applyMonth(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="f-from" className="block text-xs text-muted-foreground">
              Desde
            </label>
            <input
              id="f-from"
              type="date"
              value={urlFilters.dateFrom ?? ''}
              onChange={(e) => update({ dateFrom: e.target.value || undefined })}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="f-to" className="block text-xs text-muted-foreground">
              Hasta
            </label>
            <input
              id="f-to"
              type="date"
              value={urlFilters.dateTo ?? ''}
              onChange={(e) => update({ dateTo: e.target.value || undefined })}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Monto (en la moneda de cada gasto)</p>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              aria-label="Monto mínimo"
              placeholder="Mínimo"
              value={urlFilters.minAmount ?? ''}
              onValueChange={(v) => update({ minAmount: v || undefined })}
              className={fieldClass}
            />
            <NumberInput
              aria-label="Monto máximo"
              placeholder="Máximo"
              value={urlFilters.maxAmount ?? ''}
              onValueChange={(v) => update({ maxAmount: v || undefined })}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="f-search" className="block text-xs text-muted-foreground">
            Descripción
          </label>
          <input
            id="f-search"
            value={urlFilters.search ?? ''}
            onChange={(e) => update({ search: e.target.value || undefined })}
            placeholder="Buscar…"
            className={fieldClass}
          />
        </div>

        <div>
          <p className="block text-xs text-muted-foreground">Categorías</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {expenseCategories.map((cat) => {
              const cats = urlFilters.categories ?? [];
              const selected = cats.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    update({
                      categories: selected ? cats.filter((c) => c !== cat) : [...cats, cat],
                    })
                  }
                  className={`rounded-full px-2 py-1 text-xs ${selected ? 'bg-primary text-primary-foreground' : 'border border-input text-muted-foreground'}`}
                >
                  {categoryLabels[cat]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guardar filtro */}
        <div className="flex gap-2 border-t border-border pt-3">
          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            aria-label="Nombre del filtro"
            placeholder="Nombre del filtro…"
            className="flex-1 rounded-lg border border-input bg-muted px-2 py-1 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:text-sm"
          />
          <button
            onClick={() => {
              if (filterName.trim()) {
                createFilter.mutate({ groupId: groupId!, name: filterName.trim(), filters });
              }
            }}
            disabled={createFilter.isPending || !filterName.trim()}
            className="rounded-lg bg-secondary px-3 py-1 text-xs text-foreground disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      </div>

      {/* Totales */}
      {summary.isPending && (
        <div role="status" aria-label="Calculando totales" className="mb-6 space-y-2">
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
      )}
      {summary.isError && (
        <div className="mb-6">
          <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />
        </div>
      )}
      {summary.isSuccess && summary.data.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="font-semibold">Totales</h2>
          {summary.data.map((s) => (
            <div key={s.currency} className="rounded-2xl bg-card p-3 text-sm">
              <p className="font-medium">{s.currency}</p>
              <div className="mt-1 grid grid-cols-3 gap-2 text-foreground">
                <div>
                  <p className="text-xs text-muted-foreground">Gastos ({s.count})</p>
                  <p>{formatCents(s.totalCents, s.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Mi parte</p>
                  <p>{formatCents(s.myShareCents, s.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagué</p>
                  <p>{formatCents(s.myPaidCents, s.currency)}</p>
                </div>
              </div>
              {s.byCategory.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {s.byCategory.map((bc) => (
                    <div
                      key={bc.category}
                      className="flex justify-between text-xs text-muted-foreground"
                    >
                      <span>{categoryLabels[bc.category as keyof typeof categoryLabels]}</span>
                      <span>{formatCents(bc.totalCents, s.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Exportar */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => void handleExport('csv')}
          disabled={exportingCsv}
          className="flex-1 rounded-xl border border-input py-2 text-sm text-foreground disabled:opacity-50"
        >
          {exportingCsv ? 'Exportando…' : 'Exportar CSV'}
        </button>
        <button
          onClick={() => void handleExport('json')}
          disabled={exportingJson}
          className="flex-1 rounded-xl border border-input py-2 text-sm text-foreground disabled:opacity-50"
        >
          {exportingJson ? 'Exportando…' : 'Exportar JSON'}
        </button>
      </div>

      {/* Gastos filtrados */}
      <div>
        <h2 className="mb-3 font-semibold">
          Gastos
          {summary.isSuccess && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({summary.data.reduce((n, s) => n + s.count, 0)})
            </span>
          )}
        </h2>
        {expenses.isPending && <ExpenseListSkeleton />}
        {expenses.isError && (
          <ErrorState message={expenses.error.message} onRetry={() => expenses.refetch()} />
        )}
        {expenses.isSuccess && allExpenses.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No hay gastos con estos filtros.
          </p>
        )}
        <ul className="space-y-2">
          {allExpenses.map((e) => (
            <li key={e.id}>
              <Link
                to={`/grupos/${groupId}/gastos/${e.id}`}
                // Preload: the list already has the whole expense, so its detail opens instantly.
                onClick={() =>
                  queryClient.setQueryData(
                    trpc.expenses.get.queryKey({ expenseId: e.id }),
                    (cached) => cached ?? e,
                  )
                }
                className="flex items-center justify-between rounded-2xl bg-card p-3 active:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.paidBy.name} · {formatDate(e.date)}
                  </p>
                </div>
                <p className="ml-3 font-medium">{formatCents(e.amountCents, e.currency)}</p>
              </Link>
            </li>
          ))}
        </ul>
        <LoadMore
          hasMore={expenses.hasNextPage}
          loading={expenses.isFetchingNextPage}
          onLoadMore={loadMoreExpenses}
        />
      </div>
    </main>
  );
}
