import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@kachingga/api';
import { Bell, HandCoins } from 'lucide-react';
import { cn } from 'cn';

import { ErrorState } from '@/components/error-state';
import { CategoryIcon, EmptyState, Page, PageHeader } from '@/components/kit';
import { ExpenseListSkeleton } from '@/components/skeletons';
import { formatCents, formatTimeAgo } from '@/lib/format';
import { useOnline } from '@/lib/offline-cache';
import { useTRPC } from '@/lib/trpc';

type Notification = inferRouterOutputs<AppRouter>['notifications']['list'][number];

/** "Román agregó «Cena»", "Ana registró un pago: Beto → vos". */
function notificationText(n: Notification): string {
  const who = n.actor?.name ?? 'Alguien';
  const expense = `«${n.expense?.description ?? 'un gasto'}»`;
  const name = (p: { name: string; isMe: boolean }) => (p.isMe ? 'vos' : p.name);
  const payment = n.settlement ? `${name(n.settlement.from)} → ${name(n.settlement.to)}` : '';
  switch (n.kind) {
    case 'EXPENSE_CREATED':
      return `${who} agregó ${expense}`;
    case 'EXPENSE_UPDATED':
      return `${who} editó ${expense}`;
    case 'EXPENSE_DELETED':
      return `${who} borró ${expense}`;
    case 'SETTLEMENT_CREATED':
      return `${who} registró un pago: ${payment}`;
    case 'SETTLEMENT_DELETED':
      return `${who} borró un pago: ${payment}`;
  }
}

/** Where tapping it goes: the expense (if it's still there), else the group; a payment, its payments. */
function notificationLink(n: Notification): string {
  const group = `/grupos/${n.group.id}`;
  if (n.settlement) return `${group}/pagos`;
  if (n.expense && !n.expense.deletedAt) return `${group}/gastos/${n.expense.id}`;
  return group;
}

function NotificationRow({
  notification: n,
  unread,
}: {
  notification: Notification;
  unread: boolean;
}) {
  const item = n.expense ?? n.settlement;
  const deleted = Boolean(item?.deletedAt);
  return (
    <li className="border-b last:border-0">
      <Link
        to={notificationLink(n)}
        className="flex items-center gap-3 p-4 transition-colors max-xs:p-3 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {/* The unread dot goes on the icon: on a phone the text needs all the width it can get. */}
        <span className="relative shrink-0">
          {n.expense ? (
            <CategoryIcon icon={n.expense.category.icon} color={n.expense.category.color} />
          ) : (
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-lg bg-accent text-primary-ink"
            >
              <HandCoins className="size-[18px]" />
            </span>
          )}
          {unread && (
            <span className="absolute -top-1 -right-1 size-3 rounded-full bg-highlight ring-2 ring-card">
              <span className="sr-only">Sin leer</span>
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('line-clamp-3 break-words', unread ? 'font-semibold' : 'font-medium')}>
            {notificationText(n)}
          </p>
          {/* If it doesn't fit, the group's name is cut, never when it happened. */}
          <p className="flex text-sm text-muted-foreground">
            <span className="truncate">{n.group.name}</span>
            <span className="shrink-0 whitespace-pre"> · {formatTimeAgo(n.createdAt)}</span>
          </p>
        </div>
        {item && (
          <span
            className={cn(
              'shrink-0 text-sm font-semibold whitespace-nowrap tabular',
              deleted && 'text-muted-foreground line-through',
            )}
          >
            {formatCents(item.amountCents, item.currency)}
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * "Novedades": changes to the expenses and payments I'm in, made by others (root CLAUDE.md →
 * "Notificaciones"). Opening it marks them all as read; the ones that were unread stay highlighted
 * until leaving.
 */
export function Notifications() {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const online = useOnline();
  const list = useQuery(trpc.notifications.list.queryOptions());

  const { mutate: markAllRead } = useMutation(
    trpc.notifications.markAllRead.mutationOptions({
      onSuccess: () => queryClient.setQueryData(trpc.notifications.unreadCount.queryKey(), 0),
    }),
  );
  const hasUnread = list.data?.some((n) => !n.readAt) ?? false;
  // Seeing them is reading them (only with connection: offline nothing can be saved).
  useEffect(() => {
    if (hasUnread && online) markAllRead();
  }, [hasUnread, online, markAllRead]);

  return (
    <Page>
      <PageHeader title="Novedades" back={{ onClick: () => navigate(-1), label: 'Volver' }} />

      {list.isPending && <ExpenseListSkeleton />}

      {list.isError && <ErrorState message={list.error.message} onRetry={() => list.refetch()} />}

      {list.isSuccess && list.data.length === 0 && (
        <EmptyState
          icon={Bell}
          title="Todavía no hay novedades"
          description="Cuando alguien cargue, edite o borre un gasto o un pago en el que estás, lo vas a ver acá."
        />
      )}

      {list.isSuccess && list.data.length > 0 && (
        <ul className="rise overflow-hidden rounded-lg border bg-card shadow-sticker">
          {list.data.map((n) => (
            <NotificationRow key={n.id} notification={n} unread={!n.readAt} />
          ))}
        </ul>
      )}
    </Page>
  );
}
