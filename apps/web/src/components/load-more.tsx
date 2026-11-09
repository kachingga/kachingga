import { useEffect, useRef } from 'react';

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
      <button
        onClick={onLoadMore}
        disabled={loading}
        className="press mt-4 w-full rounded-full border bg-card py-2.5 text-sm font-medium text-muted-foreground shadow-soft disabled:opacity-50"
      >
        {loading ? 'Cargando…' : 'Cargar más'}
      </button>
    );
  }
  return (
    <div ref={marker} className="py-4">
      {loading && (
        <div role="status" aria-label="Cargando más gastos" className="space-y-2">
          <div className="h-14 animate-pulse rounded-2xl bg-muted" />
          <div className="h-14 animate-pulse rounded-2xl bg-muted" />
        </div>
      )}
    </div>
  );
}
