import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  HandCoins,
  MoreHorizontal,
  PieChart,
  Plus,
  ReceiptText,
} from 'lucide-react';
import { cn } from 'cn';

import { ArchivedNotice } from '@/components/archived-notice';
import { ErrorState } from '@/components/error-state';
import {
  Avatar,
  AvatarStack,
  Card,
  CategoryIcon,
  EmptyState,
  Money,
  Page,
  SectionTitle,
} from '@/components/kit';
import { LoadMore } from '@/components/load-more';
import { BalancesSkeleton, ExpenseListSkeleton, GroupSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { copyText, shareInviteCode } from '@/lib/share';
import { useTRPC } from '@/lib/trpc';
import { prefetchOn, usePrefetch } from '@/lib/use-prefetch';
import { isTemp } from '@/lib/optimistic';
import { useConfirm } from '@/lib/use-confirm';
import { formatCents, formatDate, formatMyBalance, formatPlainAmount } from '@/lib/format';

type GroupData = inferRouterOutputs<AppRouter>['groups']['get'];
type BalancesData = inferRouterOutputs<AppRouter>['balances']['get'];

function participantName(group: GroupData, id: string) {
  return group.participants.find((p) => p.id === id)?.name ?? id;
}

/** How "Tu situación" looks: green when they owe me, peach when I owe, lime when all square. */
const moods = {
  owed: { card: 'bg-hero text-hero-foreground', status: 'Te deben' },
  owe: { card: 'bg-owe text-owe-foreground', status: 'Debés' },
  even: { card: 'bg-even text-even-foreground', status: 'Estás al día' },
} as const;

/** "Tu situación" in the base currency: the big card at the top of the group (+ kept currencies). */
function MySituation({ group, balances }: { group: GroupData; balances: BalancesData }) {
  const base = balances.find((b) => b.currency === group.baseCurrency) ?? balances[0];
  const mine = base?.balances.find((b) => b.participantId === group.myParticipantId);
  const cents = mine?.amountCents ?? 0;
  const mood = cents > 0 ? 'owed' : cents < 0 ? 'owe' : 'even';

  // "Saldo actualizado" for a moment when it turns all square while on screen (e.g. back from
  // registering the payment, once the balances come back from the API).
  const [prevMood, setPrevMood] = useState(mood);
  const [squared, setSquared] = useState(false);
  if (prevMood !== mood) {
    setPrevMood(mood);
    setSquared(mood === 'even');
  }
  useEffect(() => {
    if (!squared) return;
    const timer = setTimeout(() => setSquared(false), 2500);
    return () => clearTimeout(timer);
  }, [squared]);

  if (!base || !mine) return null;
  const others = balances.filter((b) => b !== base);
  const myTransfers = base.transfers.filter((t) => t.fromId === group.myParticipantId);
  const single = myTransfers.length === 1 ? myTransfers[0] : undefined;
  const note =
    mood === 'even'
      ? 'No tenés pagos pendientes.'
      : mood === 'owed'
        ? 'Tu saldo pendiente de recibir en este grupo.'
        : single
          ? `Pago pendiente a ${participantName(group, single.toId)}.`
          : 'Tenés pagos pendientes en este grupo.';

  return (
    <section
      aria-label="Tu situación"
      className={cn('rise flex min-h-48 flex-col rounded-lg p-6', moods[mood].card)}
    >
      <p className="text-sm font-semibold opacity-80">Tu situación</p>
      {mood === 'even' ? (
        <p className="mt-4 font-display text-4xl font-bold">Estás al día</p>
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold">{moods[mood].status}</p>
          <Money
            cents={Math.abs(cents)}
            currency={base.currency}
            className="text-4xl sm:text-5xl"
          />
        </>
      )}
      <p className="mt-3 max-w-sm text-sm leading-relaxed opacity-85">{note}</p>
      {others.map((b) => {
        const m = b.balances.find((x) => x.participantId === group.myParticipantId);
        return m ? (
          <p key={b.currency} className="mt-1 text-sm font-semibold tabular">
            En {b.currency}: {formatMyBalance(m.amountCents, b.currency)}
          </p>
        ) : null;
      })}
      {mood === 'owe' && !group.archivedAt && (
        <Button asChild variant="secondary" className="mt-5 self-start">
          <Link
            to={
              single
                ? `/grupos/${group.id}/pagos?from=${single.fromId}&to=${single.toId}&amount=${single.amountCents}&currency=${base.currency}`
                : `/grupos/${group.id}/pagos`
            }
          >
            <HandCoins />
            Registrar pago
          </Link>
        </Button>
      )}
      {squared && (
        <p role="status" className="rise mt-4 inline-flex items-center gap-2 text-sm font-semibold">
          <Check aria-hidden className="size-4" />
          Saldo actualizado
        </p>
      )}
    </section>
  );
}

function BalanceSection({ group, balances }: { group: GroupData; balances: BalancesData }) {
  const navigate = useNavigate();
  const prefetch = usePrefetch();

  return (
    <div className="space-y-6">
      {balances.map(({ currency, balances: bals, transfers }) => (
        <div key={currency} className="space-y-5 border-b pb-5 last:border-0">
          <section>
            <div className="flex items-center justify-between">
              <SectionTitle>Saldos</SectionTitle>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                {currency}
              </span>
            </div>
            <ul className="mt-3 divide-y">
              {bals.map((b) => (
                <li key={b.participantId} className="flex items-center gap-3 py-2.5">
                  <Avatar id={b.participantId} name={participantName(group, b.participantId)} />
                  <span className="flex-1 font-semibold">
                    {participantName(group, b.participantId)}
                  </span>
                  <span
                    className={`text-sm font-semibold tabular ${b.amountCents > 0 ? 'text-positive' : b.amountCents < 0 ? 'text-negative' : 'text-muted-foreground'}`}
                  >
                    {b.amountCents > 0
                      ? `+${formatCents(b.amountCents, currency)}`
                      : b.amountCents < 0
                        ? formatCents(b.amountCents, currency)
                        : 'al día'}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <SectionTitle>Cómo quedar a mano</SectionTitle>
            {transfers.length === 0 ? (
              <EmptyState
                icon={CheckCheck}
                title="Todos al día"
                description="No hay transferencias pendientes en este grupo."
                className="py-6"
              />
            ) : (
              <ul className="mt-3 space-y-3">
                {transfers.map((t) => {
                  const isMyTransfer = t.fromId === group.myParticipantId;
                  const toParticipant = group.participants.find((p) => p.id === t.toId);

                  return (
                    <li
                      key={`${t.fromId}-${t.toId}`}
                      className={`rounded-lg p-3 ${isMyTransfer ? 'bg-negative-soft' : 'bg-muted'}`}
                    >
                      <p className="flex flex-wrap items-center gap-x-2 font-medium">
                        <span>{participantName(group, t.fromId)}</span>
                        <span className="sr-only"> → </span>
                        <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
                        <span>{participantName(group, t.toId)}</span>
                        <Money
                          cents={t.amountCents}
                          currency={currency}
                          className="ml-auto text-lg"
                        />
                      </p>

                      {isMyTransfer && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {toParticipant?.paymentAlias && (
                            <>
                              <p className="w-full text-xs text-muted-foreground">
                                Alias: {toParticipant.paymentAlias}
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  void copyText(toParticipant.paymentAlias!, 'Alias copiado')
                                }
                              >
                                <Copy />
                                Copiar alias
                              </Button>
                            </>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void copyText(formatPlainAmount(t.amountCents), 'Monto copiado')
                            }
                          >
                            <Copy />
                            Copiar monto
                          </Button>
                          {!group.archivedAt && (
                            <Button
                              size="sm"
                              {...prefetchOn(() => prefetch.settlements(group.id))}
                              onClick={() =>
                                navigate(
                                  `/grupos/${group.id}/pagos?from=${t.fromId}&to=${t.toId}&amount=${t.amountCents}&currency=${currency}`,
                                )
                              }
                            >
                              <Check />
                              Marcar como pagado
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      ))}
    </div>
  );
}

export function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const prefetch = usePrefetch();

  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));
  const balances = useQuery(trpc.balances.get.queryOptions({ groupId: groupId! }));
  const expenses = useInfiniteQuery(
    trpc.expenses.list.infiniteQueryOptions(
      { groupId: groupId! },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );

  const renameGroup = useMutation(
    trpc.groups.rename.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.groups.pathFilter());
        setRenaming(false);
      },
    }),
  );

  const setArchived = useMutation(
    trpc.groups.setArchived.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries(trpc.groups.pathFilter()),
    }),
  );

  if (group.isPending) {
    return <GroupSkeleton />;
  }
  if (group.isError) {
    return (
      <Page>
        <ErrorState message={group.error.message} onRetry={() => group.refetch()} />
        <div className="text-center">
          <Button variant="link" onClick={() => navigate('/grupos')}>
            Volver a mis grupos
          </Button>
        </div>
      </Page>
    );
  }

  const g = group.data;
  const allExpenses = expenses.data?.pages.flatMap((p) => p.items) ?? [];
  const loadMoreExpenses = () => void expenses.fetchNextPage();
  // Consecutive expenses of the same day go under one date heading (the list comes newest first).
  const days: { day: string; items: typeof allExpenses }[] = [];
  for (const expense of allExpenses) {
    const day = formatDate(expense.date);
    if (days.at(-1)?.day === day) days.at(-1)!.items.push(expense);
    else days.push({ day, items: [expense] });
  }

  return (
    <Page wide>
      {/* Header (above the rest so its menu isn't covered by the cards below) */}
      <div className="rise relative z-30">
        <Link
          to="/grupos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Mis grupos
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {renaming ? (
            <form
              className="flex min-w-0 flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                renameGroup.mutate({ groupId: groupId!, name: newName });
              }}
            >
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                aria-label="Nombre del grupo"
                className="flex-1"
              />
              <Button type="submit" disabled={renameGroup.isPending}>
                Guardar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Cancelar"
                onClick={() => setRenaming(false)}
              >
                ×
              </Button>
            </form>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar id={g.id} name={g.name} className="size-14 rounded-lg text-2xl ring-0" />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold lg:text-3xl">{g.name}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <AvatarStack people={g.participants} />
                  <p className="text-xs text-muted-foreground">
                    {g.participants.length}{' '}
                    {g.participants.length === 1 ? 'participante' : 'participantes'} · Moneda base:{' '}
                    {g.baseCurrency}
                    {g.archivedAt ? ' · Archivado' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="relative flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                to={`/grupos/${groupId}/pagos`}
                {...prefetchOn(() => prefetch.settlements(groupId!))}
              >
                <HandCoins />
                Pagos
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                to={`/grupos/${groupId}/filtros`}
                {...prefetchOn(() => prefetch.filters(groupId!))}
              >
                <PieChart />
                Filtros y totales
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Opciones del grupo"
              aria-expanded={showMenu}
            >
              <MoreHorizontal />
            </Button>

            {/* Menu */}
            {showMenu && (
              <div className="absolute top-full left-0 z-30 mt-2 w-64 sm:right-0 sm:left-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-lift">
                <Link
                  to={`/grupos/${groupId}/participantes`}
                  className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                >
                  Participantes
                </Link>
                <Link
                  to={`/grupos/${groupId}/categorias`}
                  className="block rounded-xl px-3 py-2 text-sm hover:bg-muted"
                >
                  Categorías
                </Link>
                <Button
                  onClick={() => {
                    void shareInviteCode(g.name, g.inviteCode);
                    setShowMenu(false);
                  }}
                  variant="ghost"
                  className="h-auto w-full flex-col items-start gap-0 rounded-xl px-3 py-2 text-left font-normal whitespace-normal"
                >
                  Compartir código de invitación
                  <span className="text-xs tracking-wider text-muted-foreground">
                    {g.inviteCode}
                  </span>
                </Button>
                {!g.archivedAt && (
                  <Button
                    onClick={() => {
                      setNewName(g.name);
                      setRenaming(true);
                      setShowMenu(false);
                    }}
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-xl px-3 py-2 font-normal"
                  >
                    Renombrar grupo
                  </Button>
                )}
                {!g.archivedAt ? (
                  <Button
                    onClick={async () => {
                      setShowMenu(false);
                      const ok = await confirm({
                        title: '¿Archivar este grupo?',
                        description: 'Se puede ver pero no modificar hasta desarchivarlo.',
                        confirmLabel: 'Archivar',
                      });
                      if (ok) setArchived.mutate({ groupId: groupId!, archived: true });
                    }}
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-xl px-3 py-2 font-normal text-muted-foreground"
                  >
                    Archivar grupo
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setArchived.mutate({ groupId: groupId!, archived: false });
                      setShowMenu(false);
                    }}
                    variant="ghost"
                    className="h-auto w-full justify-start rounded-xl px-3 py-2 font-normal"
                  >
                    Desarchivar grupo
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {g.archivedAt && <ArchivedNotice groupId={g.id} />}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        {/* Saldos: column on the side on wide screens */}
        <div className="space-y-6 lg:sticky lg:top-10">
          {balances.isPending && <BalancesSkeleton />}
          {balances.isError && (
            <ErrorState message={balances.error.message} onRetry={() => balances.refetch()} />
          )}
          {balances.isSuccess && balances.data.length > 0 && (
            <>
              <MySituation group={g} balances={balances.data} />
              <BalanceSection group={g} balances={balances.data} />
            </>
          )}
          {balances.isSuccess && balances.data.length === 0 && (
            <Card className="text-sm text-muted-foreground">Sin saldos todavía.</Card>
          )}
        </div>

        {/* Lista de gastos */}
        <div>
          <div className="flex items-center justify-between">
            <SectionTitle>Gastos</SectionTitle>
            {!g.archivedAt && (
              <Button asChild className="hidden lg:inline-flex">
                <Link to={`/grupos/${groupId}/gastos/nuevo`}>
                  <Plus />
                  Agregar gasto
                </Link>
              </Button>
            )}
          </div>

          {expenses.isPending && (
            <div className="mt-3">
              <ExpenseListSkeleton />
            </div>
          )}
          {expenses.isError && (
            <ErrorState message={expenses.error.message} onRetry={() => expenses.refetch()} />
          )}

          {expenses.isSuccess && allExpenses.length === 0 && (
            <EmptyState
              icon={ReceiptText}
              title="Todavía no hay gastos"
              description={g.archivedAt ? undefined : 'Agregá el primer gasto del grupo.'}
            />
          )}

          {days.map(({ day, items }) => (
            <section key={day} className="mt-5">
              <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {day}
              </p>
              <ul className="overflow-hidden rounded-lg border bg-card shadow-sticker">
                {items.map((expense) => {
                  const myShare = expense.splits.find((s) => s.participantId === g.myParticipantId);
                  const saving = isTemp(expense.id);
                  const content = (
                    <>
                      <CategoryIcon icon={expense.category.icon} color={expense.category.color} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{expense.description}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {saving
                            ? 'Guardando…'
                            : `${expense.category.name} · Pagó ${expense.paidBy.name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <Money
                          cents={expense.amountCents}
                          currency={expense.currency}
                          className="text-lg"
                        />
                        {myShare ? (
                          <p className="text-xs text-muted-foreground tabular">
                            vos: {formatCents(myShare.amountCents, expense.currency)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">no participás</p>
                        )}
                      </div>
                    </>
                  );
                  return (
                    // The one you just added (still saving) drops in with a green flash.
                    <li
                      key={expense.id}
                      className={cn('border-b last:border-0', saving && 'pop-in')}
                    >
                      {saving ? (
                        <div aria-busy="true" className="flex items-center gap-3 p-4 opacity-60">
                          {content}
                        </div>
                      ) : (
                        <Link
                          to={`/grupos/${groupId}/gastos/${expense.id}`}
                          // Preload: the list already has the whole expense, so its detail opens instantly.
                          onClick={() =>
                            queryClient.setQueryData(
                              trpc.expenses.get.queryKey({ expenseId: expense.id }),
                              (cached) => cached ?? expense,
                            )
                          }
                          className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/60"
                        >
                          {content}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <LoadMore
            hasMore={expenses.hasNextPage}
            loading={expenses.isFetchingNextPage}
            onLoadMore={loadMoreExpenses}
          />
        </div>
      </div>

      {/* Floating "Agregar gasto" on phones (on wide screens it's next to "Gastos") */}
      {!g.archivedAt && (
        <Link
          to={`/grupos/${groupId}/gastos/nuevo`}
          className="press fixed bottom-safe left-1/2 z-30 flex h-14 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground shadow-lift lg:hidden"
        >
          <Plus className="size-5" />
          Agregar gasto
        </Link>
      )}
    </Page>
  );
}
