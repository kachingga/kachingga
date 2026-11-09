import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Pencil } from 'lucide-react';

import { ArchivedNotice } from '@/components/archived-notice';
import { ErrorState } from '@/components/error-state';
import { Avatar, Card, CategoryIcon } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { ExpenseDetailSkeleton } from '@/components/skeletons';
import { useTRPC } from '@/lib/trpc';
import { useGoBack } from '@/lib/use-go-back';
import { useConfirm } from '@/lib/use-confirm';
import { formatCents, formatDate, formatNumber, splitTypeLabels } from '@/lib/format';

export function ExpenseDetail() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const expense = useQuery(trpc.expenses.get.queryOptions({ expenseId: expenseId! }));
  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));
  const base = group.data?.baseCurrency;

  // Optimistic: back to the group right away, without the expense; put back if it fails.
  const listKey = trpc.expenses.list.infiniteQueryKey({ groupId: groupId! });
  const deleteExpense = useMutation(
    trpc.expenses.delete.mutationOptions({
      onMutate: async ({ expenseId: id }) => {
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData(listKey);
        queryClient.setQueryData(listKey, (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((item) => item.id !== id),
                })),
              }
            : old,
        );
        goBack(`/grupos/${groupId}`);
        return { previous };
      },
      onError: (err, _input, context) => {
        if (context) queryClient.setQueryData(listKey, context.previous);
        toast.error(`No se borró el gasto: ${err.message}`);
      },
      onSuccess: () =>
        queryClient.removeQueries({
          queryKey: trpc.expenses.get.queryKey({ expenseId: expenseId! }),
        }),
      onSettled: () => {
        void queryClient.invalidateQueries(trpc.expenses.pathFilter());
        void queryClient.invalidateQueries(trpc.balances.get.queryFilter({ groupId: groupId! }));
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
  const isArchived = !!group.data?.archivedAt;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rise flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="press grid size-9 shrink-0 place-items-center rounded-full text-lg text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        {!isArchived && (
          <div className="flex gap-3">
            <Button asChild variant="outline" size="sm">
              <Link to={`/grupos/${groupId}/gastos/${expenseId}/editar`}>
                <Pencil />
                Editar
              </Link>
            </Button>
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
              className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive/10 px-3.5 text-[0.8rem] font-semibold text-destructive disabled:opacity-50"
            >
              {deleteExpense.isPending ? 'Borrando…' : 'Borrar'}
            </button>
          </div>
        )}
      </div>

      {isArchived && <ArchivedNotice groupId={groupId!} />}

      <div className="rise space-y-5">
        <div className="flex items-center gap-3">
          <CategoryIcon icon={e.category.icon} color={e.category.color} className="size-12" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold lg:text-3xl">{e.description}</h1>
            <p className="text-muted-foreground">
              {e.category.name} · {formatDate(e.date)}
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-hero p-6 text-primary-foreground shadow-lift dark:text-foreground">
          <p className="font-display text-4xl font-bold tabular">
            {formatCents(e.amountCents, e.currency)}
          </p>
          {base && e.exchangeRate !== null && (
            <p className="mt-1 text-sm opacity-80">
              ≈ {formatCents(Math.round(e.amountCents * e.exchangeRate), base)} · Tipo de cambio:{' '}
              {e.currency === 'ARS'
                ? `1 ${base} = ${formatNumber(1 / e.exchangeRate)} ARS`
                : `1 ${e.currency} = ${formatNumber(e.exchangeRate)} ${base}`}
            </p>
          )}
          {base && e.exchangeRate === null && e.currency !== base && (
            <p className="mt-1 text-sm opacity-80">Se mantiene en {e.currency} (saldo aparte)</p>
          )}
        </div>

        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={e.paidBy.name} />
            <div>
              <p className="text-sm text-muted-foreground">Pagó</p>
              <p className="font-medium">{e.paidBy.name}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="mb-2 text-sm text-muted-foreground">
              División ({splitTypeLabels[e.splitType as keyof typeof splitTypeLabels]})
            </p>
            <ul className="space-y-2">
              {e.splits.map((split) => (
                <li key={split.participantId} className="flex justify-between text-sm">
                  <span className="text-foreground">{split.participant.name}</span>
                  <span className="font-medium tabular">
                    {formatCents(split.amountCents, e.currency)}
                    {split.percentage != null && (
                      <span className="text-muted-foreground"> ({split.percentage}%)</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
