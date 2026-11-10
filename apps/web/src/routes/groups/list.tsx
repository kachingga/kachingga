import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  KeyRound,
  MoreHorizontal,
  Plus,
  Users,
} from 'lucide-react';

import { ErrorState } from '@/components/error-state';
import { Avatar, AvatarStack, EmptyState, MyBalance, Page } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth';
import { useTRPC } from '@/lib/trpc';
import { usePageTitle } from '@/lib/use-page-title';
import { prefetchOn, usePrefetch } from '@/lib/use-prefetch';

/** First name from the Google account ("Galo Belloponce" → "Galo"); email accounts have none. */
function firstName(session: Session | null | undefined): string | null {
  const meta: { full_name?: unknown; name?: unknown } = session?.user.user_metadata ?? {};
  const full = [meta.full_name, meta.name].find((v): v is string => typeof v === 'string') ?? '';
  return full.trim().split(/\s+/)[0] || null;
}

export function GroupList() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prefetch = usePrefetch();
  const [showArchived, setShowArchived] = useState(false);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const name = firstName(useSession());
  usePageTitle(showArchived ? 'Archivados' : 'Mis grupos');

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
      <div className="rise flex flex-wrap items-end gap-3">
        <div className="flex-1">
          {!showArchived && (
            <p className="mb-1 font-display text-xl font-semibold">
              {name ? `¡Hola, ${name}!` : '¡Hola!'}
            </p>
          )}
          <h1 className="text-3xl font-bold lg:text-4xl">
            {showArchived ? 'Archivados' : 'Mis grupos'}
          </h1>
        </div>
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
        <div role="status" aria-label="Cargando" className="grid gap-5 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {groups.isError && (
        <ErrorState message={groups.error.message} onRetry={() => groups.refetch()} />
      )}

      {isEmpty &&
        (showArchived ? (
          <EmptyState icon={Archive} title="No tenés grupos archivados" />
        ) : (
          <EmptyState
            icon={Users}
            title="Todavía no tenés grupos"
            description="Un grupo junta los gastos compartidos con tus amigos (un viaje, la casa, una salida) y calcula quién le debe a quién."
          >
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
          </EmptyState>
        ))}

      {groups.isSuccess && displayGroups.length > 0 && (
        <ul className="grid gap-5 md:grid-cols-2">
          {displayGroups.map((group, i) => (
            <li
              key={group.id}
              // Bottom padding = the card's sticker edge (the li clips the swipe actions).
              className="rise relative overflow-hidden rounded-lg pb-[3px]"
              style={{ animationDelay: `${i * 60}ms` }}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, group.id)}
            >
              {/* Swipe actions (behind the card, on phones) */}
              {/* Out of the keyboard and screen readers while hidden behind the card. */}
              <div
                inert={swipedId !== group.id}
                className="absolute top-0 right-0 bottom-[3px] flex items-center"
              >
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
                  className="flex h-full w-20 items-center justify-center rounded-r-lg bg-accent text-accent-foreground"
                >
                  <MoreHorizontal className="size-5" />
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
                // `translate` (not `transform`): the tap bounce of `press` uses `transform`.
                style={{ translate: swipedId === group.id ? '-160px 0' : undefined }}
                className="press group relative z-10 block w-full rounded-lg border bg-card p-5 text-left shadow-sticker focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex items-start justify-between gap-3">
                  <Avatar
                    id={group.id}
                    name={group.name}
                    className="size-14 rounded-lg text-2xl ring-0"
                  />
                  <ChevronRight
                    aria-hidden
                    className="mt-2 size-5 text-muted-foreground transition-transform group-hover:translate-x-1"
                  />
                </span>
                <span className="mt-4 block truncate font-display text-xl font-bold">
                  {group.name}
                </span>
                <MyBalance
                  cents={group.myBalanceCents}
                  currency={group.baseCurrency}
                  className="mt-1 block font-semibold"
                />
                <span className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
                  <AvatarStack people={group.participants} />
                  <span className="text-xs text-muted-foreground">
                    {group._count.participants}{' '}
                    {group._count.participants === 1 ? 'participante' : 'participantes'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
