import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '@/lib/trpc';

export function GroupList() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);

  const groups = useQuery(trpc.groups.list.queryOptions({ includeArchived: showArchived }));

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis grupos</h1>
        <Link to="/cuenta" className="text-sm text-neutral-500 underline">
          Mi cuenta
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        <Link
          to="/grupos/crear"
          className="flex-1 rounded-lg bg-black py-3 text-center font-medium text-white"
        >
          + Crear grupo
        </Link>
        <Link
          to="/grupos/unirme"
          className="flex-1 rounded-lg border border-neutral-300 py-3 text-center font-medium"
        >
          Unirme con código
        </Link>
      </div>

      {groups.isPending && <p className="py-8 text-center text-neutral-400">Cargando…</p>}

      {groups.isError && (
        <div className="py-8 text-center">
          <p className="text-red-600">{groups.error.message}</p>
          <button onClick={() => groups.refetch()} className="mt-2 text-sm underline">
            Reintentar
          </button>
        </div>
      )}

      {groups.isSuccess && groups.data.length === 0 && (
        <div className="py-12 text-center text-neutral-500">
          <p className="mb-2 text-lg font-medium">Todavía no tenés grupos</p>
          <p className="text-sm">Creá uno o unite con un código de invitación.</p>
        </div>
      )}

      {groups.isSuccess && groups.data.length > 0 && (
        <ul className="space-y-2">
          {groups.data.map((group) => (
            <li key={group.id}>
              <button
                onClick={() => navigate(`/grupos/${group.id}`)}
                className="flex w-full items-center justify-between rounded-xl border border-neutral-200 p-4 text-left"
              >
                <div>
                  <p className="font-semibold">{group.name}</p>
                  <p className="text-sm text-neutral-500">
                    {group._count.participants}{' '}
                    {group._count.participants === 1 ? 'persona' : 'personas'} ·{' '}
                    {group.baseCurrency}
                    {group.archivedAt ? ' · Archivado' : ''}
                  </p>
                </div>
                <span className="text-neutral-400">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setShowArchived(!showArchived)}
        className="mt-4 w-full py-2 text-sm text-neutral-500 underline"
      >
        {showArchived ? 'Ocultar archivados' : 'Ver archivados'}
      </button>
    </main>
  );
}
