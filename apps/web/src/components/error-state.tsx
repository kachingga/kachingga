import { Button } from '@/components/ui/button';

/** The API's message (already in Spanish) with a "Reintentar" button. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="py-8 text-center">
      <p className="text-destructive">{message}</p>
      <Button variant="outline" className="mt-3" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
