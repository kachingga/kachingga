import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ArchivedNotice } from '@/components/archived-notice';
import { ErrorState } from '@/components/error-state';
import { ListScreenSkeleton } from '@/components/skeletons';
import { shareInviteCode } from '@/lib/share';
import { useTRPC } from '@/lib/trpc';
import { useConfirm } from '@/lib/use-confirm';

export function Participants() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));

  const [addName, setAddName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [aliasingId, setAliasingId] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  function invalidate() {
    void queryClient.invalidateQueries(trpc.groups.pathFilter());
  }

  const addParticipant = useMutation(
    trpc.participants.add.mutationOptions({
      onSuccess: () => {
        invalidate();
        setAddName('');
      },
      onError: (e) => setError(e.message),
    }),
  );
  const rename = useMutation(
    trpc.participants.rename.mutationOptions({
      onSuccess: () => {
        invalidate();
        setRenamingId(null);
      },
      onError: (e) => setError(e.message),
    }),
  );
  const setAlias = useMutation(
    trpc.participants.setPaymentAlias.mutationOptions({
      onSuccess: () => {
        invalidate();
        setAliasingId(null);
      },
      onError: (e) => setError(e.message),
    }),
  );
  const remove = useMutation(
    trpc.participants.remove.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => setError(e.message),
    }),
  );
  const regenerateCode = useMutation(
    trpc.groups.regenerateInviteCode.mutationOptions({ onSuccess: invalidate }),
  );

  if (group.isPending) return <ListScreenSkeleton />;
  if (group.isError) {
    return (
      <main className="p-6">
        <ErrorState message={group.error.message} onRetry={() => group.refetch()} />
      </main>
    );
  }

  const g = group.data;
  const isArchived = !!g.archivedAt;
  const myId = g.myParticipantId;

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-muted-foreground">
          ←
        </button>
        <h1 className="text-xl font-bold">Participantes</h1>
      </div>

      {isArchived && (
        <div className="mb-6">
          <ArchivedNotice groupId={g.id} />
        </div>
      )}

      {/* Código de invitación */}
      <div className="mb-6 rounded-2xl bg-card p-4">
        <p className="mb-1 text-sm font-medium text-muted-foreground">Código de invitación</p>
        {showCode ? (
          <div className="space-y-2">
            <p className="py-2 text-center font-mono text-2xl font-bold tracking-widest">
              {g.inviteCode}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void shareInviteCode(g.name, g.inviteCode)}
                className="flex-1 rounded-lg border border-input py-2 text-sm text-foreground"
              >
                Compartir código
              </button>
              {!isArchived && (
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: '¿Regenerar el código?',
                      description: 'El código anterior deja de funcionar.',
                      confirmLabel: 'Regenerar',
                    });
                    if (ok) regenerateCode.mutate({ groupId: groupId! });
                  }}
                  disabled={regenerateCode.isPending}
                  className="flex-1 rounded-lg border border-input py-2 text-sm text-muted-foreground disabled:opacity-50"
                >
                  Regenerar
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCode(true)}
            className="text-sm text-muted-foreground underline"
          >
            Ver código para compartir
          </button>
        )}
      </div>

      {/* Lista */}
      <ul className="mb-6 space-y-3">
        {g.participants.map((p) => {
          const canSetAlias = !p.hasAccount || p.isMe;
          const canRemove = !p.hasAccount;

          return (
            <li key={p.id} className="rounded-2xl bg-card p-3">
              {renamingId === p.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    rename.mutate({ participantId: p.id, name: renameValue });
                  }}
                >
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    className="flex-1 rounded-lg border border-input bg-muted px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button type="submit" disabled={rename.isPending} className="text-sm font-medium">
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    className="text-sm text-muted-foreground"
                  >
                    ×
                  </button>
                </form>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {p.name}
                      {p.isMe && <span className="ml-2 text-xs text-muted-foreground">yo</span>}
                      {!p.hasAccount && (
                        <span className="ml-2 text-xs text-muted-foreground">sin cuenta</span>
                      )}
                    </p>

                    {/* Alias */}
                    {aliasingId === p.id ? (
                      <form
                        className="mt-2 flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          setAlias.mutate({
                            participantId: p.id,
                            paymentAlias: aliasValue || null,
                          });
                        }}
                      >
                        <input
                          value={aliasValue}
                          onChange={(e) => setAliasValue(e.target.value)}
                          placeholder="alias o CBU"
                          autoFocus
                          className="flex-1 rounded-lg border border-input bg-muted px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          type="submit"
                          disabled={setAlias.isPending}
                          className="text-xs font-medium"
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setAliasingId(null)}
                          className="text-xs text-muted-foreground"
                        >
                          ×
                        </button>
                      </form>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.paymentAlias ? (
                          <>
                            Alias: {p.paymentAlias}
                            {p.paymentAliasSource === 'account' && ' (de la cuenta)'}
                          </>
                        ) : (
                          'Sin alias'
                        )}
                        {canSetAlias && !isArchived && (
                          <button
                            onClick={() => {
                              setAliasingId(p.id);
                              setAliasValue(p.paymentAlias ?? '');
                            }}
                            className="ml-2 underline"
                          >
                            {p.paymentAlias ? 'Cambiar' : 'Agregar'}
                          </button>
                        )}
                      </p>
                    )}
                  </div>

                  {!isArchived && (
                    <div className="ml-2 flex gap-2">
                      <button
                        onClick={() => {
                          setRenamingId(p.id);
                          setRenameValue(p.name);
                        }}
                        className="text-xs text-muted-foreground underline"
                      >
                        Renombrar
                      </button>
                      {canRemove && p.id !== myId && (
                        <button
                          onClick={async () => {
                            const ok = await confirm({
                              title: `¿Quitar a ${p.name}?`,
                              confirmLabel: 'Quitar',
                              destructive: true,
                            });
                            if (ok) remove.mutate({ participantId: p.id });
                          }}
                          disabled={remove.isPending}
                          className="text-xs text-destructive underline disabled:opacity-50"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Agregar participante */}
      {!isArchived && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            addParticipant.mutate({ groupId: groupId!, name: addName });
          }}
          className="flex gap-2"
        >
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            required
            placeholder="Nombre (sin cuenta)"
            className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={addParticipant.isPending}
            className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
          >
            +
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </main>
  );
}
