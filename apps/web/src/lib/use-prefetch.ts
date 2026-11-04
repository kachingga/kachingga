import { useQueryClient } from '@tanstack/react-query';

import { useTRPC } from '@/lib/trpc';

// Data that's younger than this isn't fetched again when prefetching (hovering a link twice).
const FRESH_MS = 10_000;

/**
 * Loads the data of the next screen when the user is about to open it (touching or hovering a
 * link), so it opens with everything already there. Wire it to `onPointerDown`, `onMouseEnter`
 * and `onFocus` of the link. The query inputs must match the ones the screen uses.
 */
export function usePrefetch() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return {
    /** The group screen: group, balances and the first page of expenses. */
    group(groupId: string) {
      void queryClient.prefetchQuery({
        ...trpc.groups.get.queryOptions({ groupId }),
        staleTime: FRESH_MS,
      });
      void queryClient.prefetchQuery({
        ...trpc.balances.get.queryOptions({ groupId }),
        staleTime: FRESH_MS,
      });
      void queryClient.prefetchInfiniteQuery({
        ...trpc.expenses.list.infiniteQueryOptions(
          { groupId },
          { getNextPageParam: (last) => last.nextCursor },
        ),
        staleTime: FRESH_MS,
      });
    },
    /** The payments screen. */
    settlements(groupId: string) {
      void queryClient.prefetchQuery({
        ...trpc.settlements.list.queryOptions({ groupId }),
        staleTime: FRESH_MS,
      });
    },
    /** The filters screen, with no filters applied. */
    filters(groupId: string) {
      void queryClient.prefetchQuery({
        ...trpc.savedFilters.list.queryOptions({ groupId }),
        staleTime: FRESH_MS,
      });
      void queryClient.prefetchQuery({
        ...trpc.expenses.summary.queryOptions({ groupId, filters: {} }),
        staleTime: FRESH_MS,
      });
      void queryClient.prefetchInfiniteQuery({
        ...trpc.expenses.list.infiniteQueryOptions(
          { groupId, filters: {} },
          { getNextPageParam: (last) => last.nextCursor },
        ),
        staleTime: FRESH_MS,
      });
    },
  };
}

/** Props to prefetch when a link is about to be opened. */
export function prefetchOn(load: () => void) {
  return { onPointerDown: load, onMouseEnter: load, onFocus: load };
}
