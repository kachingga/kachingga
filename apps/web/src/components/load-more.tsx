import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Infinite scroll for paginated lists: an invisible marker at the end of the list that loads the
 * next page when it comes into view. Where IntersectionObserver isn't available it falls back to
 * a "Cargar más" button, so the list can always be read to the end.
 */
export function LoadMore({
  hasMore,
  loading,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}) {
  const marker = useRef<HTMLDivElement>(null);
  const canObserve = typeof IntersectionObserver !== 'undefined';

  // Syncs with something outside React (the browser's viewport), so an effect is the right tool.
  useEffect(() => {
    const node = marker.current;
    if (!node || !canObserve || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canObserve, hasMore, loading, onLoadMore]);

  if (!hasMore) return null;
  if (!canObserve) {
    return (
      <Button
        variant="outline"
        className="mt-4 w-full text-muted-foreground"
        onClick={onLoadMore}
        loading={loading}
      >
        {loading ? 'Cargando…' : 'Cargar más'}
      </Button>
    );
  }
  return (
    <div ref={marker} className="py-4">
      {loading && (
        <div role="status" aria-label="Cargando más gastos" className="space-y-2">
          <div className="h-14 animate-pulse rounded-lg bg-muted" />
          <div className="h-14 animate-pulse rounded-lg bg-muted" />
        </div>
      )}
    </div>
  );
}
