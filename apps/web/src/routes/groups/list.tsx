import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ErrorState } from '@/components/error-state';
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

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M1 6a1 1 0 0 1 1-1h20a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6Zm2 1v14h18V7H3Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M2.564 1.649A1 1 0 0 1 3.5 1h17a1 1 0 0 1 .936.649l1.5 4A1 1 0 0 1 22 7H2a1 1 0 0 1-.936-1.351l1.5-4zM4.193 3l-.75 2h17.114l-.75-2H4.193zM9 9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v4h2a1 1 0 0 1 .743 1.669l-4.5 5a1 1 0 0 1-1.486 0l-4.5-5A1 1 0 0 1 7 13h2V9zm2 1v4a1 1 0 0 1-1 1h-.755l2.255 2.505L13.755 15H13a1 1 0 0 1-1-1v-4h-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function GroupList() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef(0);

  // When showing archived, fetch all and filter to only archived
  const groups = useQuery(trpc.groups.list.queryOptions({ includeArchived: showArchived }));
  const displayGroups = showArchived
    ? (groups.data ?? []).filter((g) => g.archivedAt)
    : (groups.data ?? []);

  const setArchived = useMutation(
    trpc.groups.setArchived.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.groups.pathFilter());
        setSwipedId(null);
      },
    }),
  );

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent, groupId: string) {
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (delta > 60) {
      setSwipedId(groupId);
    } else if (delta < -20) {
      setSwipedId(null);
    }
  }

  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      onClick={() => swipedId && setSwipedId(null)}
    >
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-32 pt-14">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">
            {showArchived ? 'Archivados' : 'Grupos'}
          </h1>
          <button
            onClick={() => {
              setShowArchived(!showArchived);
              setSwipedId(null);
            }}
            aria-label={showArchived ? 'Volver a grupos' : 'Ver archivados'}
            className={`p-2 ${showArchived ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <ArchiveIcon className="h-6 w-6" />
          </button>
        </div>

        {groups.isPending && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        )}

        {groups.isError && (
          <ErrorState message={groups.error.message} onRetry={() => groups.refetch()} />
        )}

        {groups.isSuccess && displayGroups.length === 0 && (
          <div className="py-16 text-center">
            {showArchived ? (
              <p className="text-lg font-medium text-foreground">No tenés grupos archivados</p>
            ) : (
              <>
                <p className="text-lg font-medium text-foreground">Todavía no tenés grupos</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Creá uno o unite con un código.
                </p>
              </>
            )}
          </div>
        )}

        {groups.isSuccess && displayGroups.length > 0 && (
          <ul className="space-y-3">
            {displayGroups.map((group) => (
              <li
                key={group.id}
                className="relative overflow-hidden rounded-3xl"
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, group.id)}
              >
                {/* Swipe actions (behind the card) */}
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setArchived.mutate({ groupId: group.id, archived: !group.archivedAt });
                    }}
                    aria-label={group.archivedAt ? 'Desarchivar' : 'Archivar'}
                    className="flex h-full w-20 flex-col items-center justify-center gap-1 bg-secondary"
                  >
                    <ArchiveIcon className="h-5 w-5 text-foreground" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSwipedId(null);
                      navigate(`/grupos/${group.id}`);
                    }}
                    aria-label="Opciones"
                    className="flex h-full w-20 flex-col items-center justify-center gap-1 rounded-r-3xl bg-accent"
                  >
                    <span className="text-xl leading-none text-foreground">⋯</span>
                  </button>
                </div>

                {/* Card (slides left on swipe) */}
                <button
                  onClick={(e) => {
                    if (swipedId === group.id) {
                      e.stopPropagation();
                      setSwipedId(null);
                    } else {
                      navigate(`/grupos/${group.id}`);
                    }
                  }}
                  style={{
                    transform: swipedId === group.id ? 'translateX(-160px)' : 'translateX(0)',
                  }}
                  className="relative z-10 flex w-full items-center gap-4 rounded-3xl bg-card p-4 text-left transition-transform duration-200 active:bg-accent"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${avatarColor(group.name)}`}
                  >
                    <span className="text-xl font-bold text-white">
                      {group.name[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{group.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {group._count.participants}{' '}
                      {group._count.participants === 1 ? 'persona' : 'personas'} ·{' '}
                      {group.baseCurrency}
                    </p>
                  </div>
                  <span className="text-muted-foreground">›</span>
                </button>
              </li>
            ))}
          </ul>
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
              className="whitespace-nowrap rounded-2xl bg-muted px-5 py-3 text-sm font-medium text-foreground shadow-lg"
            >
              Unirme con código
            </Link>
            <Link
              to="/grupos/crear"
              onClick={() => setFabOpen(false)}
              className="whitespace-nowrap rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg"
            >
              Crear grupo
            </Link>
          </div>
        </>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background pb-safe">
        <div className="mx-auto flex max-w-md items-center justify-around px-4 pt-2 pb-4">
          <button className="flex flex-col items-center gap-1">
            <svg className="h-6 w-6 text-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
            </svg>
            <span className="text-xs font-medium text-foreground">Grupos</span>
          </button>

          <button
            onClick={() => setFabOpen(!fabOpen)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
          >
            <span
              className={`text-2xl font-light text-primary-foreground transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}
            >
              +
            </span>
          </button>

          <Link to="/cuenta" className="flex flex-col items-center gap-1">
            <svg className="h-6 w-6 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
            <span className="text-xs text-muted-foreground">Perfil</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
