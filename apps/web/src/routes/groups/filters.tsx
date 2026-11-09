import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { ErrorState } from '@/components/error-state';
import { CategoryIcon } from '@/components/kit';
import { LoadMore } from '@/components/load-more';
import { NumberInput } from '@/components/number-input';
import { ExpenseListSkeleton } from '@/components/skeletons';
import { useTRPC } from '@/lib/trpc';
import { formatCents, formatDate, monthRange, today } from '@/lib/format';
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
  'mt-1.5 h-10 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30';

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
  const categories = useQuery(trpc.categories.list.queryOptions({ groupId: groupId! }));
  const categoryById = new Map((categories.data ?? []).map((c) => [c.id, c]));

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
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="rise flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="press grid size-9 shrink-0 place-items-center rounded-full text-lg text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-bold lg:text-3xl">Filtros y totales</h1>
      </div>

      {/* Atajos */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => myId && update({ involvedParticipantId: myId })}
          className="press rounded-full border border-input px-3 py-1 text-sm text-foreground bg-card"
        >
          Mis gastos
        </button>
        <button
          onClick={() => applyMonth(today().slice(0, 7))}
          className="press rounded-full border border-input px-3 py-1 text-sm text-foreground bg-card"
        >
          Este mes
        </button>
        <button
          onClick={() => setFilters({})}
          className="press rounded-full border border-input px-3 py-1 text-sm text-muted-foreground bg-card"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Filtros guardados */}
      {savedFilters.isSuccess && savedFilters.data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedFilters.data.map((sf) => (
            <div
              key={sf.id}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-accent py-1 pr-1 pl-3 text-accent-foreground"
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* Formulario de filtros */}
        <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft lg:sticky lg:top-10">
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <div>
              <label htmlFor="f-paid" className="block text-xs font-medium text-muted-foreground">
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
              <label htmlFor="f-split" className="block text-xs font-medium text-muted-foreground">
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
            <label htmlFor="f-involved" className="block text-xs font-medium text-muted-foreground">
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
            <label htmlFor="f-month" className="block text-xs font-medium text-muted-foreground">
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

          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <div>
              <label htmlFor="f-from" className="block text-xs font-medium text-muted-foreground">
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
              <label htmlFor="f-to" className="block text-xs font-medium text-muted-foreground">
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
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
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
            <label htmlFor="f-search" className="block text-xs font-medium text-muted-foreground">
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
            <p className="block text-xs font-medium text-muted-foreground">Categorías</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(categories.data ?? [])
                // Archived ones only if they're already in the filter (e.g. from a saved one).
                .filter((cat) => !cat.archived || urlFilters.categoryIds?.includes(cat.id))
                .map((cat) => {
                  const ids = urlFilters.categoryIds ?? [];
                  const selected = ids.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        update({
                          categoryIds: selected
                            ? ids.filter((id) => id !== cat.id)
                            : [...ids, cat.id],
                        })
                      }
                      className={`press flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-xs font-medium ${selected ? 'bg-primary text-primary-foreground' : 'border border-input bg-card text-muted-foreground'}`}
                    >
                      <CategoryIcon
                        icon={cat.icon}
                        color={cat.color}
                        className="size-6 rounded-full [&_svg]:size-3.5"
                      />
                      {cat.name}
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
              className="flex-1 h-11 rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            />
            <button
              onClick={() => {
                if (filterName.trim()) {
                  createFilter.mutate({ groupId: groupId!, name: filterName.trim(), filters });
                }
              }}
              disabled={createFilter.isPending || !filterName.trim()}
              className="press rounded-full bg-secondary px-4 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>

        <div className="space-y-6">
          {/* Totales */}
          {summary.isPending && (
            <div role="status" aria-label="Calculando totales" className="space-y-2">
              <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            </div>
          )}
          {summary.isError && (
            <div>
              <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />
            </div>
          )}
          {summary.isSuccess && summary.data.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold">Totales</h2>
              {summary.data.map((s) => (
                <div
                  key={s.currency}
                  className="rise rounded-2xl border bg-card p-5 text-sm shadow-soft"
                >
                  <p className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {s.currency}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-foreground">
                    <div>
                      <p className="text-xs text-muted-foreground">Gastos ({s.count})</p>
                      <p className="font-display text-lg font-bold tabular">
                        {formatCents(s.totalCents, s.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mi parte</p>
                      <p className="font-display text-lg font-bold tabular">
                        {formatCents(s.myShareCents, s.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pagué</p>
                      <p className="font-display text-lg font-bold tabular">
                        {formatCents(s.myPaidCents, s.currency)}
                      </p>
                    </div>
                  </div>
                  {s.byCategory.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t pt-3">
                      {s.byCategory.map((bc) => (
                        <div
                          key={bc.categoryId}
                          className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
                        >
                          <CategoryTotalLabel
                            category={categoryById.get(bc.categoryId)}
                            name={bc.name}
                          />
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
          <div className="flex gap-2">
            <button
              onClick={() => void handleExport('csv')}
              disabled={exportingCsv}
              className="press flex-1 rounded-full border bg-card py-2.5 text-sm font-medium text-foreground shadow-soft disabled:opacity-50"
            >
              {exportingCsv ? 'Exportando…' : 'Exportar CSV'}
            </button>
            <button
              onClick={() => void handleExport('json')}
              disabled={exportingJson}
              className="press flex-1 rounded-full border bg-card py-2.5 text-sm font-medium text-foreground shadow-soft disabled:opacity-50"
            >
              {exportingJson ? 'Exportando…' : 'Exportar JSON'}
            </button>
          </div>

          {/* Gastos filtrados */}
          <div>
            <h2 className="mb-3 text-lg font-bold">
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
            <ul className="overflow-hidden rounded-2xl border bg-card shadow-soft empty:hidden">
              {allExpenses.map((e) => (
                <li key={e.id} className="border-b last:border-0">
                  <Link
                    to={`/grupos/${groupId}/gastos/${e.id}`}
                    // Preload: the list already has the whole expense, so its detail opens instantly.
                    onClick={() =>
                      queryClient.setQueryData(
                        trpc.expenses.get.queryKey({ expenseId: e.id }),
                        (cached) => cached ?? e,
                      )
                    }
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/60"
                  >
                    <CategoryIcon icon={e.category.icon} color={e.category.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {e.paidBy.name} · {formatDate(e.date)}
                      </p>
                    </div>
                    <p className="font-semibold tabular">
                      {formatCents(e.amountCents, e.currency)}
                    </p>
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
        </div>
      </div>
    </div>
  );
}

/** A category's name in the totals, with its icon when the group's list has it. */
function CategoryTotalLabel({
  category,
  name,
}: {
  category?: { icon: string; color: string };
  name: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {category && (
        <CategoryIcon
          icon={category.icon}
          color={category.color}
          className="size-6 rounded-lg [&_svg]:size-3.5"
        />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
