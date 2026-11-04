import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ErrorState } from '@/components/error-state';
import { ExpenseDetailSkeleton } from '@/components/skeletons';
import { useTRPC } from '@/lib/trpc';
import { useConfirm } from '@/lib/use-confirm';
import {
  categoryLabels,
  formatCents,
  formatDate,
  formatNumber,
  splitTypeLabels,
} from '@/lib/format';

export function ExpenseDetail() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const expense = useQuery(trpc.expenses.get.queryOptions({ expenseId: expenseId! }));
  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));
  const base = group.data?.baseCurrency;

  const deleteExpense = useMutation(
    trpc.expenses.delete.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.expenses.pathFilter());
        void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId: groupId! }));
        navigate(`/grupos/${groupId}`);
      },
    }),
  );

  if (expense.isPending) {
    return <ExpenseDetailSkeleton />;
  }
  if (expense.isError) {
    return (
      <div className="p-6 text-center">
        <ErrorState message={expense.error.message} onRetry={() => expense.refetch()} />
        <button
          onClick={() => navigate(-1)}
          className="mt-2 text-sm text-muted-foreground underline"
        >
          Volver
        </button>
      </div>
    );
  }

  const e = expense.data;

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-muted-foreground">
          ←
        </button>
        <div className="flex gap-3">
          <Link
            to={`/grupos/${groupId}/gastos/${expenseId}/editar`}
            className="text-sm text-muted-foreground underline"
          >
            Editar
          </Link>
          <button
            onClick={async () => {
              const ok = await confirm({
                title: '¿Borrar este gasto?',
                description: 'Deja de contar en los saldos.',
                confirmLabel: 'Borrar',
                destructive: true,
              });
              if (ok) deleteExpense.mutate({ expenseId: expenseId! });
            }}
            disabled={deleteExpense.isPending}
            className="text-sm text-destructive disabled:opacity-50"
          >
            {deleteExpense.isPending ? 'Borrando…' : 'Borrar'}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">{e.description}</h1>
          <p className="mt-1 text-muted-foreground">
            {categoryLabels[e.category as keyof typeof categoryLabels]} · {formatDate(e.date)}
          </p>
        </div>

        <div className="rounded-2xl bg-card p-4">
          <p className="text-3xl font-bold">{formatCents(e.amountCents, e.currency)}</p>
          {base && e.exchangeRate !== null && (
            <p className="mt-1 text-sm text-muted-foreground">
              ≈ {formatCents(Math.round(e.amountCents * e.exchangeRate), base)} · Tipo de cambio:{' '}
              {e.currency === 'ARS'
                ? `1 ${base} = ${formatNumber(1 / e.exchangeRate)} ARS`
                : `1 ${e.currency} = ${formatNumber(e.exchangeRate)} ${base}`}
            </p>
          )}
          {base && e.exchangeRate === null && e.currency !== base && (
            <p className="mt-1 text-sm text-muted-foreground">
              Se mantiene en {e.currency} (saldo aparte)
            </p>
          )}
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Pagó</p>
          <p className="font-medium">{e.paidBy.name}</p>
        </div>

        <div>
          <p className="mb-2 text-sm text-muted-foreground">
            División ({splitTypeLabels[e.splitType as keyof typeof splitTypeLabels]})
          </p>
          <ul className="space-y-1">
            {e.splits.map((split) => (
              <li key={split.participantId} className="flex justify-between text-sm">
                <span className="text-foreground">{split.participant.name}</span>
                <span className="font-medium">
                  {formatCents(split.amountCents, e.currency)}
                  {split.percentage != null && (
                    <span className="text-muted-foreground"> ({split.percentage}%)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
