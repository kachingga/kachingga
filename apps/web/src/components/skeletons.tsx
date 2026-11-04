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

/** Back arrow + title, like every screen's header. */
function HeaderSkeleton({ subtitle }: { subtitle?: boolean }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <Skeleton className="h-6 w-6" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        {subtitle && <Skeleton className="h-3 w-12" />}
      </div>
    </div>
  );
}

function ExpenseRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between rounded-2xl bg-card p-3">
          <div className="space-y-2">
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

/** The balances card of a group. */
export function BalancesSkeleton() {
  return (
    <Loading className="space-y-3 rounded-2xl bg-card p-4">
      <Skeleton className="h-3 w-10" />
      <Skeleton className="h-6 w-44" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
    </Loading>
  );
}

/** Rows of a simple list (payments, participants). */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Loading className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 rounded-2xl bg-card p-3">
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
    <Loading className="mx-auto min-h-dvh max-w-md p-4 pb-24">
      <HeaderSkeleton subtitle />
      <div className="space-y-6">
        <div className="space-y-3 rounded-2xl bg-card p-4">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 flex-1 rounded-xl" />
        </div>
        <ExpenseRows rows={4} />
      </div>
    </Loading>
  );
}

/** A form screen (add/edit expense). */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <Loading className="mx-auto min-h-dvh max-w-md p-6">
      <HeaderSkeleton />
      <div className="space-y-5">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** The expense detail screen. */
export function ExpenseDetailSkeleton() {
  return (
    <Loading className="mx-auto min-h-dvh max-w-md p-6">
      <HeaderSkeleton />
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-24" />
        </div>
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
    <div className="mx-auto min-h-dvh max-w-md p-6">
      <HeaderSkeleton />
      <Skeleton className="mb-6 h-12 w-full rounded-xl" />
      <RowsSkeleton rows={rows} />
    </div>
  );
}
