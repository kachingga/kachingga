import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { expenseCategories, type ExpenseFilters } from '@kachingga/api/schemas';
import { useTRPC } from '@/lib/trpc';
import { categoryLabels, formatCents, formatDate, toDateInput } from '@/lib/format';

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

  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));
  const savedFilters = useQuery(trpc.savedFilters.list.queryOptions({ groupId: groupId! }));

  const [filters, setFilters] = useState<ExpenseFilters>({});
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

  function applyMonth() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    setFilters((f) => ({ ...f, dateFrom: first, dateTo: last }));
  }

  const allExpenses = expenses.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-neutral-500">
          ←
        </button>
        <h1 className="text-xl font-bold">Filtros y totales</h1>
      </div>

      {/* Atajos */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => myId && setFilters((f) => ({ ...f, involvedParticipantId: myId }))}
          className="rounded-full border border-neutral-300 px-3 py-1 text-sm"
        >
          Mis gastos
        </button>
        <button
          onClick={applyMonth}
          className="rounded-full border border-neutral-300 px-3 py-1 text-sm"
        >
          Este mes
        </button>
        <button
          onClick={() => setFilters({})}
          className="rounded-full border border-neutral-300 px-3 py-1 text-sm text-neutral-500"
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
              className="flex items-center gap-1 rounded-full border border-neutral-200 py-1 pl-3 pr-1"
            >
              <button onClick={() => setFilters(sf.filters)} className="text-sm">
                {sf.name}
              </button>
              <button
                onClick={() => deleteFilter.mutate({ savedFilterId: sf.id })}
                aria-label={`Borrar filtro ${sf.name}`}
                className="px-1 text-xs text-neutral-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de filtros */}
      <div className="mb-6 space-y-3 rounded-xl border border-neutral-200 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Quién pagó</label>
            <select
              value={filters.paidById ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, paidById: e.target.value || undefined }))}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1 text-sm"
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
            <label className="block text-xs text-neutral-500">Involucrado</label>
            <select
              value={filters.involvedParticipantId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  involvedParticipantId: e.target.value || undefined,
                }))
              }
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1 text-sm"
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-neutral-500">Desde</label>
            <input
              type="date"
              value={filters.dateFrom ? toDateInput(filters.dateFrom) : ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  dateFrom: e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined,
                }))
              }
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Hasta</label>
            <input
              type="date"
              value={filters.dateTo ? toDateInput(filters.dateTo) : ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  dateTo: e.target.value ? new Date(e.target.value + 'T23:59:59') : undefined,
                }))
              }
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-neutral-500">Descripción</label>
          <input
            value={filters.search ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
            placeholder="Buscar…"
            className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-500">Categorías</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {expenseCategories.map((cat) => {
              const selected = filters.categories?.includes(cat) ?? false;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() =>
                    setFilters((f) => {
                      const cats = f.categories ?? [];
                      return {
                        ...f,
                        categories: selected ? cats.filter((c) => c !== cat) : [...cats, cat],
                      };
                    })
                  }
                  className={`rounded-full px-2 py-1 text-xs ${selected ? 'bg-black text-white' : 'border border-neutral-300'}`}
                >
                  {categoryLabels[cat]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guardar filtro */}
        <div className="flex gap-2 border-t border-neutral-100 pt-3">
          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Nombre del filtro…"
            className="flex-1 rounded-lg border border-neutral-200 px-2 py-1 text-sm"
          />
          <button
            onClick={() => {
              if (filterName.trim()) {
                createFilter.mutate({ groupId: groupId!, name: filterName.trim(), filters });
              }
            }}
            disabled={createFilter.isPending || !filterName.trim()}
            className="rounded-lg bg-neutral-800 px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
      </div>

      {/* Totales */}
      {summary.isPending && <p className="mb-4 text-sm text-neutral-400">Calculando totales…</p>}
      {summary.isSuccess && summary.data.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="font-semibold">Totales</h2>
          {summary.data.map((s) => (
            <div key={s.currency} className="rounded-xl border border-neutral-200 p-3 text-sm">
              <p className="font-medium">{s.currency}</p>
              <div className="mt-1 grid grid-cols-3 gap-2 text-neutral-600">
                <div>
                  <p className="text-xs text-neutral-400">Gastos ({s.count})</p>
                  <p>{formatCents(s.totalCents, s.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Mi parte</p>
                  <p>{formatCents(s.myShareCents, s.currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Pagué</p>
                  <p>{formatCents(s.myPaidCents, s.currency)}</p>
                </div>
              </div>
              {s.byCategory.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-neutral-100 pt-2">
                  {s.byCategory.map((bc) => (
                    <div
                      key={bc.category}
                      className="flex justify-between text-xs text-neutral-500"
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
          className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm disabled:opacity-50"
        >
          {exportingCsv ? 'Exportando…' : 'Exportar CSV'}
        </button>
        <button
          onClick={() => void handleExport('json')}
          disabled={exportingJson}
          className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm disabled:opacity-50"
        >
          {exportingJson ? 'Exportando…' : 'Exportar JSON'}
        </button>
      </div>

      {/* Gastos filtrados */}
      <div>
        <h2 className="mb-3 font-semibold">Gastos</h2>
        {expenses.isPending && <p className="text-sm text-neutral-400">Cargando…</p>}
        {expenses.isError && <p className="text-sm text-red-600">{expenses.error.message}</p>}
        {expenses.isSuccess && allExpenses.length === 0 && (
          <p className="py-6 text-center text-sm text-neutral-400">
            No hay gastos con estos filtros.
          </p>
        )}
        <ul className="space-y-2">
          {allExpenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.description}</p>
                <p className="text-xs text-neutral-500">
                  {e.paidBy.name} · {formatDate(e.date)}
                </p>
              </div>
              <p className="ml-3 font-medium">{formatCents(e.amountCents, e.currency)}</p>
            </li>
          ))}
        </ul>
        {expenses.hasNextPage && (
          <button
            onClick={() => expenses.fetchNextPage()}
            disabled={expenses.isFetchingNextPage}
            className="mt-4 w-full rounded-lg border border-neutral-300 py-2 text-sm disabled:opacity-50"
          >
            {expenses.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
          </button>
        )}
      </div>
    </main>
  );
}
