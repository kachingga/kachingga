import { SearchX } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/kit';
import { Button } from '@/components/ui/button';

/** A URL that isn't a screen of the app (an old or mistyped link): say so, it's not an error to report. */
export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <EmptyState
        icon={SearchX}
        title="Esta página no existe"
        description="Puede que el link esté mal escrito o sea viejo."
      >
        <Button asChild className="mt-6">
          <Link to="/grupos">Ir a mis grupos</Link>
        </Button>
      </EmptyState>
    </main>
  );
}
