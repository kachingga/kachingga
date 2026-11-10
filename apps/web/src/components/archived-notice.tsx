import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useTRPC } from '@/lib/trpc';

/**
 * An archived group can be seen but not changed (CLAUDE.md → "Grupos"): every group screen shows
 * this instead of its edit actions, with the way out (unarchive). The API enforces it anyway.
 */
export function ArchivedNotice({ groupId }: { groupId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const unarchive = useMutation(
    trpc.groups.setArchived.mutationOptions({
      onSuccess: () => void queryClient.invalidateQueries(trpc.groups.pathFilter()),
    }),
  );

  return (
    <div
      role="status"
      className="rise flex items-center justify-between gap-3 rounded-lg border bg-highlight/15 p-4 text-sm shadow-sticker"
    >
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Grupo archivado.</span> Se puede ver pero no
        modificar.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => unarchive.mutate({ groupId, archived: false })}
        loading={unarchive.isPending}
      >
        {unarchive.isPending ? 'Desarchivando…' : 'Desarchivar'}
      </Button>
    </div>
  );
}
