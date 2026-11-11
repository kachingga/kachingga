import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { ErrorState } from '@/components/error-state';
import { Card, CategoryIcon, Chip, Field, Money, Page, PageHeader } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
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

// What's typed in "Descripción" goes to the URL (and so to the queries) this long after the last key:
// one summary and one list per search, not one per key (#159).
const SEARCH_DELAY_MS = 300;

function triggerDownload(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  const writeFilters = (next: UrlFilters) =>
    setSearchParams(writeUrlFilters(next), { replace: true });

  // What the "Descripción" input shows while the person types in it (null = the URL's). It stays
  // after going to the URL: the URL is read trimmed, and a space between words would vanish.
  const [typedSearch, setTypedSearch] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  function typeSearch(text: string) {
    setTypedSearch(text);
    clearTimeout(searchTimer.current);
    // `urlFilters` can't get old meanwhile: any other change cancels this timer (setFilters).
    searchTimer.current = setTimeout(
      () => writeFilters({ ...urlFilters, search: text || undefined }),
      SEARCH_DELAY_MS,
    );
  }
  const setFilters = (next: UrlFilters) => {
    clearTimeout(searchTimer.current);
    setTypedSearch(null);
    writeFilters(next);
  };
  // Any other filter goes right away, with what was typed in the search (even if it hadn't gone yet).
  const update = (changes: Partial<UrlFilters>) =>
    setFilters({
      ...urlFilters,
      ...(typedSearch !== null && { search: typedSearch || undefined }),
      ...changes,
    });

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
    <Page wide>
      <PageHeader
        title="Filtros y totales"
        back={{ onClick: () => navigate(-1), label: 'Volver' }}
      />

      {/* Atajos */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => myId && update({ involvedParticipantId: myId })}
        >
          Mis gastos
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyMonth(today().slice(0, 7))}>
          Este mes
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setFilters({})}
        >
          Limpiar filtros
        </Button>
      </div>

      {/* Filtros guardados */}
      {savedFilters.isSuccess && savedFilters.data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedFilters.data.map((sf) => (
            <div
              key={sf.id}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-accent py-1 pr-1 pl-3 text-accent-foreground"
            >
              <Button
                variant="link"
                size="xs"
                className="px-0 text-accent-foreground"
                onClick={() => setFilters(fromApiFilters(sf.filters))}
              >
                {sf.name}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full text-muted-foreground"
                onClick={() => deleteFilter.mutate({ savedFilterId: sf.id })}
                aria-label={`Borrar filtro ${sf.name}`}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* Formulario de filtros */}
        <Card className="space-y-3 lg:sticky lg:top-10">
          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <Field label="Quién pagó" htmlFor="f-paid" small>
              <NativeSelect
                id="f-paid"
                value={urlFilters.paidById ?? ''}
                onChange={(e) => update({ paidById: e.target.value || undefined })}
              >
                <option value="">Todos</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Le corresponde a" htmlFor="f-split" small>
              <NativeSelect
                id="f-split"
                value={urlFilters.splitParticipantId ?? ''}
                onChange={(e) => update({ splitParticipantId: e.target.value || undefined })}
              >
                <option value="">Todos</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field label="Involucrado (pagó o le corresponde)" htmlFor="f-involved" small>
            <NativeSelect
              id="f-involved"
              value={urlFilters.involvedParticipantId ?? ''}
              onChange={(e) => update({ involvedParticipantId: e.target.value || undefined })}
            >
              <option value="">Todos</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Mes" htmlFor="f-month" small>
            <Input
              id="f-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => applyMonth(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
            <Field label="Desde" htmlFor="f-from" small>
              <Input
                id="f-from"
                type="date"
                value={urlFilters.dateFrom ?? ''}
                onChange={(e) => update({ dateFrom: e.target.value || undefined })}
              />
            </Field>
            <Field label="Hasta" htmlFor="f-to" small>
              <Input
                id="f-to"
                type="date"
                value={urlFilters.dateTo ?? ''}
                onChange={(e) => update({ dateTo: e.target.value || undefined })}
              />
            </Field>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Monto (en la moneda de cada gasto)
            </p>
            <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
              <NumberInput
                aria-label="Monto mínimo"
                placeholder="Mínimo"
                value={urlFilters.minAmount ?? ''}
                onValueChange={(v) => update({ minAmount: v || undefined })}
              />
              <NumberInput
                aria-label="Monto máximo"
                placeholder="Máximo"
                value={urlFilters.maxAmount ?? ''}
                onValueChange={(v) => update({ maxAmount: v || undefined })}
              />
            </div>
          </div>

          <Field label="Descripción" htmlFor="f-search" small>
            <Input
              id="f-search"
              value={typedSearch ?? urlFilters.search ?? ''}
              onChange={(e) => typeSearch(e.target.value)}
              placeholder="Buscar…"
            />
          </Field>

          <div>
            <Label id="f-categories" className="text-xs text-muted-foreground">
              Categorías
            </Label>
            <div
              className="mt-1.5 flex flex-wrap gap-1"
              role="group"
              aria-labelledby="f-categories"
            >
              {(categories.data ?? [])
                // Archived ones only if they're already in the filter (e.g. from a saved one).
                .filter((cat) => !cat.archived || urlFilters.categoryIds?.includes(cat.id))
                .map((cat) => {
                  const ids = urlFilters.categoryIds ?? [];
                  const selected = ids.includes(cat.id);
                  return (
                    <Chip
                      key={cat.id}
                      active={selected}
                      className="flex items-center gap-1.5 py-1 pr-3 pl-1 text-xs"
                      onClick={() =>
                        update({
                          categoryIds: selected
                            ? ids.filter((id) => id !== cat.id)
                            : [...ids, cat.id],
                        })
                      }
                    >
                      <CategoryIcon
                        icon={cat.icon}
                        color={cat.color}
                        className="size-6 rounded-full [&_svg]:size-3.5"
                      />
                      {cat.name}
                    </Chip>
                  );
                })}
            </div>
          </div>

          {/* Guardar filtro */}
          <div className="flex gap-2 border-t border-border pt-3">
            <Input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              aria-label="Nombre del filtro"
              placeholder="Nombre del filtro…"
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={() => {
                if (filterName.trim()) {
                  createFilter.mutate({ groupId: groupId!, name: filterName.trim(), filters });
                }
              }}
              loading={createFilter.isPending}
              disabled={!filterName.trim()}
            >
              Guardar
            </Button>
          </div>
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </Card>

        <div className="space-y-6">
          {/* Totales */}
          {summary.isPending && (
            <div role="status" aria-label="Calculando totales" className="space-y-2">
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
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
                  className="rise rounded-lg border bg-card p-5 text-sm shadow-sticker"
                >
                  <p className="w-fit rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {s.currency}
                  </p>
                  {/* Phone: the total on its own row and the other two below (three in a row didn't
                      fit amounts in the millions). From sm up, the three in a row. */}
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-foreground sm:grid-cols-3">
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <p className="text-xs text-muted-foreground">Gastos ({s.count})</p>
                      <Money
                        cents={s.totalCents}
                        currency={s.currency}
                        className="text-2xl sm:text-lg"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Mi parte</p>
                      <Money cents={s.myShareCents} currency={s.currency} className="text-lg" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Pagué</p>
                      <Money cents={s.myPaidCents} currency={s.currency} className="text-lg" />
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
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => void handleExport('csv')}
              loading={exportingCsv}
            >
              {exportingCsv ? 'Exportando…' : 'Exportar CSV'}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => void handleExport('json')}
              loading={exportingJson}
            >
              {exportingJson ? 'Exportando…' : 'Exportar JSON'}
            </Button>
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
            <ul className="overflow-hidden rounded-lg border bg-card shadow-sticker empty:hidden">
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
                    className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
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
    </Page>
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
