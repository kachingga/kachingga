import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Pencil } from 'lucide-react';

import { ArchivedNotice } from '@/components/archived-notice';
import { ErrorState } from '@/components/error-state';
import { Avatar, Card, CategoryIcon, Money, SectionTitle } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { ExpenseDetailSkeleton } from '@/components/skeletons';
import { useTRPC } from '@/lib/trpc';
import { useGoBack } from '@/lib/use-go-back';
import { useConfirm } from '@/lib/use-confirm';
import { usePageTitle } from '@/lib/use-page-title';
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
  usePageTitle(expense.data?.description);
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
        <Button variant="link" className="mt-2 text-muted-foreground" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>
    );
  }

  const e = expense.data;
  const isArchived = !!group.data?.archivedAt;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rise flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          onClick={() => navigate(-1)}
          aria-label="Volver"
        >
          <ArrowLeft className="size-5" />
        </Button>
        {!isArchived && (
          <div className="flex gap-3">
            <Button asChild variant="outline" size="sm">
              <Link to={`/grupos/${groupId}/gastos/${expenseId}/editar`}>
                <Pencil />
                Editar
              </Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                const ok = await confirm({
                  title: '¿Borrar este gasto?',
                  description: 'Deja de contar en los saldos.',
                  confirmLabel: 'Borrar',
                  destructive: true,
                });
                if (ok) deleteExpense.mutate({ expenseId: expenseId! });
              }}
              loading={deleteExpense.isPending}
            >
              {deleteExpense.isPending ? 'Borrando…' : 'Borrar'}
            </Button>
          </div>
        )}
      </div>

      {isArchived && <ArchivedNotice groupId={groupId!} />}

      <Card className="rise text-center">
        <CategoryIcon
          icon={e.category.icon}
          color={e.category.color}
          className="mx-auto size-14 [&_svg]:size-6"
        />
        <h1 className="mt-4 text-2xl font-bold break-words lg:text-3xl">{e.description}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {e.category.name} · {formatDate(e.date)}
        </p>
        <Money
          cents={e.amountCents}
          currency={e.currency}
          className="mt-5 block text-4xl sm:text-5xl"
        />
        {base && e.exchangeRate !== null && (
          <p className="mt-2 text-sm text-muted-foreground">
            ≈ {formatCents(Math.round(e.amountCents * e.exchangeRate), base)} · Tipo de cambio:{' '}
            {e.currency === 'ARS'
              ? `1 ${base} = ${formatNumber(1 / e.exchangeRate)} ARS`
              : `1 ${e.currency} = ${formatNumber(e.exchangeRate)} ${base}`}
          </p>
        )}
        {base && e.exchangeRate === null && e.currency !== base && (
          <p className="mt-2 text-sm text-muted-foreground">
            Se mantiene en {e.currency} (saldo aparte)
          </p>
        )}
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-muted py-1.5 pr-3 pl-1.5 text-sm">
          <Avatar id={e.paidBy.id} name={e.paidBy.name} className="size-6 text-xs ring-0" />
          Pagó {e.paidBy.name}
        </p>
      </Card>

      <Card className="rise">
        <SectionTitle>
          {`División (${splitTypeLabels[e.splitType as keyof typeof splitTypeLabels]})`}
        </SectionTitle>
        <ul className="mt-3 divide-y">
          {e.splits.map((split) => (
            <li key={split.participantId} className="flex items-center gap-3 py-2.5">
              <Avatar id={split.participantId} name={split.participant.name} />
              <span className="flex-1 font-medium">{split.participant.name}</span>
              <span className="font-semibold tabular">
                {formatCents(split.amountCents, e.currency)}
                {split.percentage != null && (
                  <span className="font-normal text-muted-foreground"> ({split.percentage}%)</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
