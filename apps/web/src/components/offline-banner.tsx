import { useOnline } from '@/lib/offline-cache';

/** Shown while there's no connection: the screens keep the last data they loaded (read-only). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-highlight px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 text-center text-sm font-medium text-highlight-foreground"
    >
      Sin conexión: mostrando lo último que viste
    </div>
  );
}
