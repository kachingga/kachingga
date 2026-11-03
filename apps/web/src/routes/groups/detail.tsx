import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';

import { useTRPC } from '@/lib/trpc';
import { categoryLabels, formatCents, formatDate } from '@/lib/format';

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
          <div key={currency} className="rounded-xl border border-neutral-200 p-4">
            <p className="mb-3 text-sm font-semibold text-neutral-500">{currency}</p>

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
                <p key={b.participantId} className="text-sm text-neutral-600">
                  <span className="font-medium">{participantName(group, b.participantId)}</span>
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
              <div className="space-y-2 border-t border-neutral-100 pt-3">
                <p className="text-xs font-medium text-neutral-500">Cómo quedar a mano</p>
                {transfers.map((t) => {
                  const isMyTransfer = t.fromId === group.myParticipantId;
                  const toParticipant = group.participants.find((p) => p.id === t.toId);

                  return (
                    <div
                      key={`${t.fromId}-${t.toId}`}
                      className={`rounded-lg p-3 ${isMyTransfer ? 'bg-neutral-50' : ''}`}
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
                              <p className="w-full text-xs text-neutral-500">
                                Alias: {toParticipant.paymentAlias}
                              </p>
                              <button
                                onClick={() =>
                                  void navigator.clipboard.writeText(toParticipant.paymentAlias!)
                                }
                                className="rounded border border-neutral-300 px-3 py-1 text-xs"
                              >
                                Copiar alias
                              </button>
                            </>
                          )}
                          <button
                            onClick={() =>
                              void navigator.clipboard.writeText((t.amountCents / 100).toFixed(2))
                            }
                            className="rounded border border-neutral-300 px-3 py-1 text-xs"
                          >
                            Copiar monto
                          </button>
                          <button
                            onClick={() =>
                              navigate(
                                `/grupos/${group.id}/pagos?from=${t.fromId}&to=${t.toId}&amount=${t.amountCents}&currency=${currency}`,
                              )
                            }
                            className="rounded bg-black px-3 py-1 text-xs text-white"
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
    return <p className="p-6 text-center text-neutral-400">Cargando…</p>;
  }
  if (group.isError) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600">{group.error.message}</p>
        <button onClick={() => navigate('/grupos')} className="mt-2 text-sm underline">
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
        <button onClick={() => navigate('/grupos')} className="text-neutral-500">
          ←
        </button>

        {renaming ? (
          <form
            className="flex flex-1 mx-2 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              renameGroup.mutate({ groupId: groupId!, name: newName });
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <button type="submit" disabled={renameGroup.isPending} className="text-sm font-medium">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className="text-sm text-neutral-500"
            >
              ×
            </button>
          </form>
        ) : (
          <div className="flex-1 px-2">
            <h1 className="font-bold">{g.name}</h1>
            <p className="text-xs text-neutral-500">
              {g.baseCurrency}
              {g.archivedAt ? ' · Archivado' : ''}
            </p>
          </div>
        )}

        <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-neutral-500">
          ⋯
        </button>
      </div>

      {/* Menu */}
      {showMenu && (
        <div className="mx-4 mb-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-sm">
          <Link
            to={`/grupos/${groupId}/participantes`}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Participantes
          </Link>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(g.inviteCode);
              setShowMenu(false);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-50"
          >
            Copiar código de invitación ({g.inviteCode})
          </button>
          <button
            onClick={() => {
              setNewName(g.name);
              setRenaming(true);
              setShowMenu(false);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-50"
          >
            Renombrar grupo
          </button>
          {!g.archivedAt ? (
            <button
              onClick={() => {
                if (confirm('¿Archivar este grupo?'))
                  setArchived.mutate({ groupId: groupId!, archived: true });
                setShowMenu(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-50"
            >
              Archivar grupo
            </button>
          ) : (
            <button
              onClick={() => {
                setArchived.mutate({ groupId: groupId!, archived: false });
                setShowMenu(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-50"
            >
              Desarchivar grupo
            </button>
          )}
        </div>
      )}

      <div className="space-y-6 px-4">
        {/* Saldos */}
        {balances.isPending && <p className="text-sm text-neutral-400">Cargando saldos…</p>}
        {balances.isError && <p className="text-sm text-red-600">{balances.error.message}</p>}
        {balances.isSuccess && balances.data.length > 0 && (
          <BalanceSection group={g} balances={balances.data} />
        )}
        {balances.isSuccess && balances.data.length === 0 && (
          <p className="text-sm text-neutral-400">Sin saldos todavía.</p>
        )}

        {/* Links de acción */}
        <div className="flex gap-2">
          <Link
            to={`/grupos/${groupId}/pagos`}
            className="flex-1 rounded-lg border border-neutral-300 py-2 text-center text-sm"
          >
            Pagos
          </Link>
          <Link
            to={`/grupos/${groupId}/filtros`}
            className="flex-1 rounded-lg border border-neutral-300 py-2 text-center text-sm"
          >
            Filtros y totales
          </Link>
        </div>

        {/* Lista de gastos */}
        <div>
          <h2 className="mb-3 font-semibold">Gastos</h2>

          {expenses.isPending && <p className="text-sm text-neutral-400">Cargando gastos…</p>}
          {expenses.isError && <p className="text-sm text-red-600">{expenses.error.message}</p>}

          {expenses.isSuccess && allExpenses.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">
              Todavía no hay gastos.{' '}
              <Link to={`/grupos/${groupId}/gastos/nuevo`} className="underline">
                Agregar uno
              </Link>
            </p>
          )}

          <ul className="space-y-2">
            {allExpenses.map((expense) => {
              const myShare = expense.splits.find((s) => s.participantId === g.myParticipantId);
              return (
                <li key={expense.id}>
                  <Link
                    to={`/grupos/${groupId}/gastos/${expense.id}`}
                    className="flex items-center justify-between rounded-xl border border-neutral-200 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{expense.description}</p>
                      <p className="text-xs text-neutral-500">
                        {categoryLabels[expense.category as keyof typeof categoryLabels]} ·{' '}
                        {expense.paidBy.name} · {formatDate(expense.date)}
                      </p>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="font-semibold">
                        {formatCents(expense.amountCents, expense.currency)}
                      </p>
                      {myShare && (
                        <p className="text-xs text-neutral-500">
                          yo: {formatCents(myShare.amountCents, expense.currency)}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
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
      </div>

      {/* FAB */}
      {!g.archivedAt && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center">
          <Link
            to={`/grupos/${groupId}/gastos/nuevo`}
            className="rounded-full bg-black px-6 py-3 font-medium text-white shadow-lg"
          >
            + Agregar gasto
          </Link>
        </div>
      )}
    </main>
  );
}
