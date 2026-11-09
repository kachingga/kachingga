import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

// Loading placeholders with the shape of each screen's real content, so nothing jumps when the
// data arrives. All of them are announced as "Cargando" to screen readers.

function Loading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-label="Cargando" className={className}>
      {children}
    </div>
  );
}

const card = 'rounded-2xl border bg-card shadow-soft';

/** Back link + title, like every screen's header. */
function HeaderSkeleton({ subtitle }: { subtitle?: boolean }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-56" />
      {subtitle && <Skeleton className="h-3 w-40" />}
    </div>
  );
}

function ExpenseRows({ rows }: { rows: number }) {
  return (
    <div className={`${card} divide-y overflow-hidden`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A list of expenses (group screen, filters). */
export function ExpenseListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Loading>
      <ExpenseRows rows={rows} />
    </Loading>
  );
}

/** "Tu situación" + the balances card of a group. */
export function BalancesSkeleton() {
  return (
    <Loading className="space-y-6">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className={`${card} space-y-3 p-5`}>
        <Skeleton className="h-5 w-20" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** Rows of a simple list (payments, participants). */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Loading className={`${card} divide-y overflow-hidden`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      ))}
    </Loading>
  );
}

/** The whole group screen, while the group itself loads. */
export function GroupSkeleton() {
  return (
    <Loading className="mx-auto w-full max-w-6xl space-y-6">
      <HeaderSkeleton subtitle />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-3xl" />
          <div className={`${card} space-y-3 p-5`}>
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-20" />
          <ExpenseRows rows={4} />
        </div>
      </div>
    </Loading>
  );
}

/** A form screen (add/edit expense). */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <Loading className="mx-auto w-full max-w-2xl space-y-6">
      <HeaderSkeleton />
      <div className={`${card} space-y-5 p-5`}>
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** The expense detail screen. */
export function ExpenseDetailSkeleton() {
  return (
    <Loading className="mx-auto w-full max-w-2xl space-y-6">
      <HeaderSkeleton />
      <div className={`${card} space-y-5 p-5`}>
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </Loading>
  );
}

/** A screen with a header and a list (payments, participants). */
export function ListScreenSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <HeaderSkeleton />
      <Skeleton className="h-11 w-full rounded-full" />
      <RowsSkeleton rows={rows} />
    </div>
  );
}
