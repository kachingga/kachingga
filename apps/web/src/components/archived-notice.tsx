import { useMutation, useQueryClient } from '@tanstack/react-query';

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
      className="rise flex items-center justify-between gap-3 rounded-2xl border bg-highlight/15 p-4 text-sm shadow-soft"
    >
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Grupo archivado.</span> Se puede ver pero no
        modificar.
      </p>
      <button
        onClick={() => unarchive.mutate({ groupId, archived: false })}
        disabled={unarchive.isPending}
        className="press shrink-0 rounded-full border border-input px-3 py-1 font-semibold text-foreground disabled:opacity-50 bg-card"
      >
        {unarchive.isPending ? 'Desarchivando…' : 'Desarchivar'}
      </button>
    </div>
  );
}
