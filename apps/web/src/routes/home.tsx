import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '@/lib/trpc';

// Placeholder: replace with the real screens (V1.md → "Pantallas").
export function Home() {
  const trpc = useTRPC();
  const ping = useQuery(trpc.health.ping.queryOptions());

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-3xl font-semibold">Kachingga</h1>
      <p className="text-sm text-neutral-500">
        {ping.isPending
          ? 'Conectando con la API…'
          : ping.isError
            ? 'Sin conexión con la API'
            : 'API conectada'}
      </p>
    </main>
  );
}
