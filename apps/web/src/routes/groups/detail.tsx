import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';

import { ErrorState } from '@/components/error-state';
import { BalancesSkeleton, ExpenseListSkeleton, GroupSkeleton } from '@/components/skeletons';
import { useTRPC } from '@/lib/trpc';
import { isTemp } from '@/lib/optimistic';
import { useConfirm } from '@/lib/use-confirm';
import { categoryLabels, formatCents, formatDate, formatPlainAmount } from '@/lib/format';

type GroupData = inferRouterOutputs<AppRouter>['groups']['get'];
type BalancesData = inferRouterOutputs<AppRouter>['balances']['get'];

function participantName(group: GroupData, id: string) {
  return group.participants.find((p) => p.id === id)?.name ?? id;
}

function BalanceSection({ group, balances }: { group: GroupData; balances: BalancesData }) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {balances.map(({ currency, balances: bals, transfers }) => {
        const mine = bals.find((b) => b.participantId === group.myParticipantId);
        return (
          <div key={currency} className="rounded-2xl bg-card p-4">
            <p className="mb-3 text-sm font-semibold text-muted-foreground">{currency}</p>

            {mine && (
              <p className="mb-3 text-lg font-semibold">
                {mine.amountCents === 0
                  ? 'Estás al día'
                  : mine.amountCents > 0
                    ? `Te deben ${formatCents(mine.amountCents, currency)}`
                    : `Debés ${formatCents(-mine.amountCents, currency)}`}
              </p>
            )}

            <div className="mb-3 space-y-1">
              {bals.map((b) => (
                <p key={b.participantId} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {participantName(group, b.participantId)}
                  </span>
                  {': '}
                  {b.amountCents > 0
                    ? `+${formatCents(b.amountCents, currency)}`
                    : b.amountCents < 0
                      ? formatCents(b.amountCents, currency)
                      : 'al día'}
                </p>
              ))}
            </div>

            {transfers.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">Cómo quedar a mano</p>
                {transfers.map((t) => {
                  const isMyTransfer = t.fromId === group.myParticipantId;
                  const toParticipant = group.participants.find((p) => p.id === t.toId);

                  return (
                    <div
                      key={`${t.fromId}-${t.toId}`}
                      className={`rounded-xl p-3 ${isMyTransfer ? 'bg-muted' : ''}`}
                    >
                      <p className="text-sm">
                        <span className="font-medium">{participantName(group, t.fromId)}</span>
                        {' → '}
                        <span className="font-medium">{participantName(group, t.toId)}</span>{' '}
                        <span className="font-semibold">
                          {formatCents(t.amountCents, currency)}
                        </span>
                      </p>

                      {isMyTransfer && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {toParticipant?.paymentAlias && (
                            <>
                              <p className="w-full text-xs text-muted-foreground">
                                Alias: {toParticipant.paymentAlias}
                              </p>
                              <button
                                onClick={() =>
                                  void navigator.clipboard.writeText(toParticipant.paymentAlias!)
                                }
                                className="rounded border border-input px-3 py-1 text-xs text-foreground"
                              >
                                Copiar alias
                              </button>
                            </>
                          )}
                          <button
                            onClick={() =>
                              void navigator.clipboard.writeText(formatPlainAmount(t.amountCents))
                            }
                            className="rounded border border-input px-3 py-1 text-xs text-foreground"
                          >
                            Copiar monto
                          </button>
                          <button
                            onClick={() =>
                              navigate(
                                `/grupos/${group.id}/pagos?from=${t.fromId}&to=${t.toId}&amount=${t.amountCents}&currency=${currency}`,
                              )
                            }
                            className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
                          >
                            Marcar como pagado
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

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
      <div className="p-6 text-center">
        <ErrorState message={group.error.message} onRetry={() => group.refetch()} />
        <button
          onClick={() => navigate('/grupos')}
          className="mt-2 text-sm text-muted-foreground underline"
        >
          Volver a mis grupos
        </button>
      </div>
    );
  }

  const g = group.data;
  const allExpenses = expenses.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-24">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          ←
        </button>

        {renaming ? (
          <form
            className="mx-2 flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              renameGroup.mutate({ groupId: groupId!, name: newName });
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="flex-1 rounded border border-input bg-card px-2 py-1 text-sm text-foreground focus:outline-none"
            />
            <button type="submit" disabled={renameGroup.isPending} className="text-sm font-medium">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className="text-sm text-muted-foreground"
            >
              ×
            </button>
          </form>
        ) : (
          <div className="flex-1 px-2">
            <h1 className="font-bold">{g.name}</h1>
            <p className="text-xs text-muted-foreground">
              {g.baseCurrency}
              {g.archivedAt ? ' · Archivado' : ''}
            </p>
          </div>
        )}

        <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-muted-foreground">
          ⋯
        </button>
      </div>

      {/* Menu */}
      {showMenu && (
        <div className="mx-4 mb-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
          <Link
            to={`/grupos/${groupId}/participantes`}
            className="block rounded-xl px-3 py-2 text-sm hover:bg-accent"
          >
            Participantes
          </Link>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(g.inviteCode);
              setShowMenu(false);
            }}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-accent"
          >
            Copiar código de invitación ({g.inviteCode})
          </button>
          <button
            onClick={() => {
              setNewName(g.name);
              setRenaming(true);
              setShowMenu(false);
            }}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-accent"
          >
            Renombrar grupo
          </button>
          {!g.archivedAt ? (
            <button
              onClick={async () => {
                setShowMenu(false);
                const ok = await confirm({
                  title: '¿Archivar este grupo?',
                  description: 'Se puede ver pero no modificar hasta desarchivarlo.',
                  confirmLabel: 'Archivar',
                });
                if (ok) setArchived.mutate({ groupId: groupId!, archived: true });
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              Archivar grupo
            </button>
          ) : (
            <button
              onClick={() => {
                setArchived.mutate({ groupId: groupId!, archived: false });
                setShowMenu(false);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-accent"
            >
              Desarchivar grupo
            </button>
          )}
        </div>
      )}

      <div className="space-y-6 px-4">
        {/* Saldos */}
        {balances.isPending && <BalancesSkeleton />}
        {balances.isError && (
          <ErrorState message={balances.error.message} onRetry={() => balances.refetch()} />
        )}
        {balances.isSuccess && balances.data.length > 0 && (
          <BalanceSection group={g} balances={balances.data} />
        )}
        {balances.isSuccess && balances.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin saldos todavía.</p>
        )}

        {/* Links de acción */}
        <div className="flex gap-2">
          <Link
            to={`/grupos/${groupId}/pagos`}
            className="flex-1 rounded-xl border border-border py-2 text-center text-sm text-foreground"
          >
            Pagos
          </Link>
          <Link
            to={`/grupos/${groupId}/filtros`}
            className="flex-1 rounded-xl border border-border py-2 text-center text-sm text-foreground"
          >
            Filtros y totales
          </Link>
        </div>

        {/* Lista de gastos */}
        <div>
          <h2 className="mb-3 font-semibold">Gastos</h2>

          {expenses.isPending && <ExpenseListSkeleton />}
          {expenses.isError && (
            <ErrorState message={expenses.error.message} onRetry={() => expenses.refetch()} />
          )}

          {expenses.isSuccess && allExpenses.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Todavía no hay gastos.{' '}
              <Link to={`/grupos/${groupId}/gastos/nuevo`} className="underline">
                Agregar uno
              </Link>
            </p>
          )}

          <ul className="space-y-2">
            {allExpenses.map((expense) => {
              const myShare = expense.splits.find((s) => s.participantId === g.myParticipantId);
              const saving = isTemp(expense.id);
              const content = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {saving
                        ? 'Guardando…'
                        : `${categoryLabels[expense.category as keyof typeof categoryLabels]} · ${expense.paidBy.name} · ${formatDate(expense.date)}`}
                    </p>
                  </div>
                  <div className="ml-3 text-right">
                    <p className="font-semibold">
                      {formatCents(expense.amountCents, expense.currency)}
                    </p>
                    {myShare && (
                      <p className="text-xs text-muted-foreground">
                        yo: {formatCents(myShare.amountCents, expense.currency)}
                      </p>
                    )}
                  </div>
                </>
              );
              return (
                <li key={expense.id}>
                  {saving ? (
                    <div
                      aria-busy="true"
                      className="flex items-center justify-between rounded-2xl bg-card p-3 opacity-60"
                    >
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
                      className="flex items-center justify-between rounded-2xl bg-card p-3 active:bg-accent"
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          {expenses.hasNextPage && (
            <button
              onClick={() => expenses.fetchNextPage()}
              disabled={expenses.isFetchingNextPage}
              className="mt-4 w-full rounded-xl border border-border py-2 text-sm text-muted-foreground disabled:opacity-50"
            >
              {expenses.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
            </button>
          )}
        </div>
      </div>

      {/* FAB */}
      {!g.archivedAt && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center">
          <Link
            to={`/grupos/${groupId}/gastos/nuevo`}
            className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground shadow-lg"
          >
            + Agregar gasto
          </Link>
        </div>
      )}
    </main>
  );
}
