import { useEffect } from 'react';
import { useRouteError } from 'react-router';

import { ErrorState } from '@/components/error-state';
import { reportError } from '@/lib/monitoring';

/** A screen crashed while rendering: report it and offer to reload instead of a blank page. */
export function RouteError() {
  const error = useRouteError();
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <ErrorState
        message="Algo salió mal en esta pantalla."
        onRetry={() => window.location.reload()}
      />
    </main>
  );
}
