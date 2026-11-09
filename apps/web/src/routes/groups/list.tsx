import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ChevronRight, KeyRound, Plus } from 'lucide-react';

import { ErrorState } from '@/components/error-state';
import { Avatar, Card, MyBalance, Page } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/lib/trpc';
import { prefetchOn, usePrefetch } from '@/lib/use-prefetch';

export function GroupList() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prefetch = usePrefetch();
  const [showArchived, setShowArchived] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef(0);

  // When showing archived, fetch all and filter to only archived
  const groups = useQuery(trpc.groups.list.queryOptions({ includeArchived: showArchived }));
  const displayGroups = showArchived
    ? (groups.data ?? []).filter((g) => g.archivedAt)
    : (groups.data ?? []);
  const isEmpty = groups.isSuccess && displayGroups.length === 0;

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
    <Page onClick={() => swipedId && setSwipedId(null)}>
      {/* Title, actions and archived toggle: on phones the actions go full width under the title. */}
      <div className="rise flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-3xl font-bold lg:text-4xl">
          {showArchived ? 'Archivados' : 'Mis grupos'}
        </h1>
        {!isEmpty && !showArchived && (
          <div className="order-last grid w-full grid-cols-2 gap-2 sm:order-none sm:flex sm:w-auto">
            <Button asChild variant="outline" className="px-3 sm:px-5">
              <Link to="/grupos/unirme">
                <KeyRound className="hidden sm:block" />
                Unirme con código
              </Link>
            </Button>
            <Button asChild className="px-3 sm:px-5">
              <Link to="/grupos/crear">
                <Plus />
                Crear grupo
              </Link>
            </Button>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setShowArchived(!showArchived);
            setSwipedId(null);
          }}
          aria-label={showArchived ? 'Volver a grupos' : 'Ver archivados'}
          aria-pressed={showArchived}
        >
          {showArchived ? <ArchiveRestore /> : <Archive />}
        </Button>
      </div>

      {groups.isPending && (
        <div role="status" aria-label="Cargando" className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {groups.isError && (
        <ErrorState message={groups.error.message} onRetry={() => groups.refetch()} />
      )}

      {isEmpty &&
        (showArchived ? (
          <Card className="rise py-12 text-center">
            <p className="text-lg font-medium">No tenés grupos archivados</p>
          </Card>
        ) : (
          <Card className="rise flex flex-col items-center py-14 text-center">
            <span
              aria-hidden
              className="grid size-16 place-items-center rounded-2xl bg-accent text-3xl"
            >
              🧉
            </span>
            <h2 className="mt-5 text-xl font-bold">Todavía no tenés grupos</h2>
            <p className="mt-2 max-w-xs text-muted-foreground">
              Un grupo junta los gastos compartidos con tus amigos (un viaje, la casa, una salida) y
              calcula quién le debe a quién.
            </p>
            <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
              <Button asChild>
                <Link to="/grupos/crear">
                  <Plus />
                  Crear grupo
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/grupos/unirme">
                  <KeyRound />
                  Unirme con código
                </Link>
              </Button>
            </div>
          </Card>
        ))}

      {groups.isSuccess && displayGroups.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {displayGroups.map((group, i) => (
            <li
              key={group.id}
              className="rise relative overflow-hidden rounded-2xl"
              style={{ animationDelay: `${i * 60}ms` }}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, group.id)}
            >
              {/* Swipe actions (behind the card, on phones) */}
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setArchived.mutate({ groupId: group.id, archived: !group.archivedAt });
                  }}
                  aria-label={group.archivedAt ? 'Desarchivar' : 'Archivar'}
                  className="flex h-full w-20 items-center justify-center bg-secondary text-secondary-foreground"
                >
                  {group.archivedAt ? (
                    <ArchiveRestore className="size-5" />
                  ) : (
                    <Archive className="size-5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSwipedId(null);
                    navigate(`/grupos/${group.id}`);
                  }}
                  aria-label="Opciones"
                  className="flex h-full w-20 items-center justify-center rounded-r-2xl bg-accent text-xl text-accent-foreground"
                >
                  ⋯
                </button>
              </div>

              {/* Card (slides left on swipe) */}
              <button
                {...prefetchOn(() => prefetch.group(group.id))}
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
                className="press group relative z-10 flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-soft transition-transform duration-200 hover:shadow-lift"
              >
                <Avatar name={group.name} className="size-12 rounded-xl bg-muted text-lg ring-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{group.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {group._count.participants}{' '}
                    {group._count.participants === 1 ? 'persona' : 'personas'}
                  </p>
                  <MyBalance
                    cents={group.myBalanceCents}
                    currency={group.baseCurrency}
                    className="text-sm font-medium"
                  />
                </div>
                <ChevronRight
                  aria-hidden
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
