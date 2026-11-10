import { LogoMark } from '@/components/app-shell';

/**
 * The logo alone on the background, while something has to load before the first screen (the
 * session). Same as the splash in index.html and the iPhone startup images: no jump between them.
 */
export function Splash() {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="fixed inset-0 grid place-items-center bg-background"
    >
      <LogoMark className="size-[40vmin]" />
    </div>
  );
}
