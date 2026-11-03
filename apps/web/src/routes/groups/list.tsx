import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '@/lib/trpc';

// Deterministic avatar color from group name
const AVATAR_COLORS = [
  'bg-violet-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-orange-500',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-amber-500',
  'bg-pink-600',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function GroupList() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const groups = useQuery(trpc.groups.list.queryOptions({ includeArchived: showArchived }));

  return (
    <div className="flex min-h-dvh flex-col bg-black">
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-32 pt-14">
        <h1 className="mb-6 text-3xl font-bold text-white">Grupos</h1>

        {groups.isPending && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-800" />
            ))}
          </div>
        )}

        {groups.isError && (
          <div className="py-12 text-center">
            <p className="text-red-400">{groups.error.message}</p>
            <button
              onClick={() => groups.refetch()}
              className="mt-3 text-sm text-neutral-400 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {groups.isSuccess && groups.data.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-lg font-medium text-neutral-300">Todavía no tenés grupos</p>
            <p className="mt-1 text-sm text-neutral-500">Creá uno o unite con un código.</p>
          </div>
        )}

        {groups.isSuccess && groups.data.length > 0 && (
          <ul className="space-y-3">
            {groups.data.map((group) => (
              <li key={group.id}>
                <button
                  onClick={() => navigate(`/grupos/${group.id}`)}
                  className="flex w-full items-center gap-4 rounded-3xl bg-neutral-900 p-4 text-left active:bg-neutral-800"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${avatarColor(group.name)}`}
                  >
                    <span className="text-xl font-bold text-white">
                      {group.name[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{group.name}</p>
                    <p className="text-sm text-neutral-400">
                      {group._count.participants}{' '}
                      {group._count.participants === 1 ? 'persona' : 'personas'} ·{' '}
                      {group.baseCurrency}
                      {group.archivedAt ? ' · Archivado' : ''}
                    </p>
                  </div>
                  <span className="text-neutral-600">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {groups.isSuccess && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="mt-4 w-full py-2 text-sm text-neutral-600"
          >
            {showArchived ? 'Ocultar archivados' : 'Ver archivados'}
          </button>
        )}
      </main>

      {/* FAB menu */}
      {fabOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setFabOpen(false)} />
          <div className="fixed bottom-24 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-3">
            <Link
              to="/grupos/unirme"
              onClick={() => setFabOpen(false)}
              className="whitespace-nowrap rounded-2xl bg-neutral-800 px-5 py-3 text-sm font-medium text-white shadow-lg"
            >
              Unirme con código
            </Link>
            <Link
              to="/grupos/crear"
              onClick={() => setFabOpen(false)}
              className="whitespace-nowrap rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black shadow-lg"
            >
              Crear grupo
            </Link>
          </div>
        </>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-neutral-800 bg-black pb-safe">
        <div className="mx-auto flex max-w-md items-center justify-around px-4 pt-2 pb-4">
          <button className="flex flex-col items-center gap-1">
            <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
            </svg>
            <span className="text-xs font-medium text-white">Grupos</span>
          </button>

          <button
            onClick={() => setFabOpen(!fabOpen)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg"
          >
            <span
              className={`text-2xl font-light text-black transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}
            >
              +
            </span>
          </button>

          <Link to="/cuenta" className="flex flex-col items-center gap-1">
            <svg className="h-6 w-6 text-neutral-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
            <span className="text-xs text-neutral-500">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
