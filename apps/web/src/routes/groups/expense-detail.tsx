import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Spinner } from '@/components/spinner';
import { useTRPC } from '@/lib/trpc';
import {
  categoryLabels,
  decimalToDisplay,
  formatCents,
  formatDate,
  splitTypeLabels,
} from '@/lib/format';

export function ExpenseDetail() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

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
    return <Spinner fullScreen />;
  }
  if (expense.isError) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">{expense.error.message}</p>
        <button onClick={() => navigate(-1)} className="mt-2 text-sm text-neutral-400 underline">
          Volver
        </button>
      </div>
    );
  }

  const e = expense.data;

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-neutral-400">
          ←
        </button>
        <div className="flex gap-3">
          <Link
            to={`/grupos/${groupId}/gastos/${expenseId}/editar`}
            className="text-sm text-neutral-400 underline"
          >
            Editar
          </Link>
          <button
            onClick={() => {
              if (confirm('¿Borrar este gasto?')) {
                deleteExpense.mutate({ expenseId: expenseId! });
              }
            }}
            disabled={deleteExpense.isPending}
            className="text-sm text-red-400 disabled:opacity-50"
          >
            {deleteExpense.isPending ? 'Borrando…' : 'Borrar'}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">{e.description}</h1>
          <p className="mt-1 text-neutral-400">
            {categoryLabels[e.category as keyof typeof categoryLabels]} · {formatDate(e.date)}
          </p>
        </div>

        <div className="rounded-2xl bg-neutral-900 p-4">
          <p className="text-3xl font-bold">{formatCents(e.amountCents, e.currency)}</p>
          {base && e.exchangeRate !== null && (
            <p className="mt-1 text-sm text-neutral-400">
              ≈ {formatCents(Math.round(e.amountCents * e.exchangeRate), base)} · Tipo de cambio:{' '}
              {e.currency === 'ARS'
                ? `1 ${base} = ${decimalToDisplay(1 / e.exchangeRate)} ARS`
                : `1 ${e.currency} = ${decimalToDisplay(e.exchangeRate)} ${base}`}
            </p>
          )}
          {base && e.exchangeRate === null && e.currency !== base && (
            <p className="mt-1 text-sm text-neutral-400">
              Se mantiene en {e.currency} (saldo aparte)
            </p>
          )}
        </div>

        <div>
          <p className="text-sm text-neutral-400">Pagó</p>
          <p className="font-medium">{e.paidBy.name}</p>
        </div>

        <div>
          <p className="mb-2 text-sm text-neutral-400">
            División ({splitTypeLabels[e.splitType as keyof typeof splitTypeLabels]})
          </p>
          <ul className="space-y-1">
            {e.splits.map((split) => (
              <li key={split.participantId} className="flex justify-between text-sm">
                <span className="text-neutral-300">{split.participant.name}</span>
                <span className="font-medium">
                  {formatCents(split.amountCents, e.currency)}
                  {split.percentage != null && (
                    <span className="text-neutral-400"> ({split.percentage}%)</span>
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
