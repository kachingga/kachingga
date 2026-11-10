import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';

import { ArchivedNotice } from '@/components/archived-notice';
import { ErrorState } from '@/components/error-state';
import { Avatar, Page, PageHeader } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      <div className="p-6">
        <ErrorState message={group.error.message} onRetry={() => group.refetch()} />
      </div>
    );
  }

  const g = group.data;
  const isArchived = !!g.archivedAt;
  const myId = g.myParticipantId;

  return (
    <Page>
      <PageHeader title="Participantes" back={{ onClick: () => navigate(-1), label: 'Volver' }} />

      {isArchived && <ArchivedNotice groupId={g.id} />}

      {/* Código de invitación */}
      <section className="rise rounded-lg bg-hero p-6 text-hero-foreground">
        <p className="mb-1 text-sm font-semibold opacity-80">Código de invitación</p>
        {showCode ? (
          <div className="space-y-3">
            <p className="py-2 font-display text-3xl font-bold tracking-wider">{g.inviteCode}</p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => void shareInviteCode(g.name, g.inviteCode)}
              >
                Compartir código
              </Button>
              {!isArchived && (
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={async () => {
                    const ok = await confirm({
                      title: '¿Regenerar el código?',
                      description: 'El código anterior deja de funcionar.',
                      confirmLabel: 'Regenerar',
                    });
                    if (ok) regenerateCode.mutate({ groupId: groupId! });
                  }}
                  loading={regenerateCode.isPending}
                >
                  Regenerar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => setShowCode(true)}>
            Ver código para compartir
          </Button>
        )}
      </section>

      {/* Lista */}
      <ul className="space-y-3">
        {g.participants.map((p) => {
          // Only my own alias: nobody sets someone else's, and people without account have none.
          const canSetAlias = p.isMe;
          const canRemove = !p.hasAccount;

          return (
            <li key={p.id} className="rounded-lg border bg-card p-4 shadow-sticker">
              {renamingId === p.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    rename.mutate({ participantId: p.id, name: renameValue });
                  }}
                >
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    aria-label={`Nuevo nombre de ${p.name}`}
                    autoFocus
                    className="flex-1"
                  />
                  <Button type="submit" variant="soft" loading={rename.isPending}>
                    OK
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Cancelar"
                    onClick={() => setRenamingId(null)}
                  >
                    <X />
                  </Button>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <Avatar id={p.id} name={p.name} />
                  <div className="min-w-0 flex-1">
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
                        <Input
                          value={aliasValue}
                          onChange={(e) => setAliasValue(e.target.value)}
                          placeholder="alias o CBU"
                          aria-label={`Alias de ${p.name}`}
                          autoFocus
                          className="flex-1"
                        />
                        <Button type="submit" variant="soft" loading={setAlias.isPending}>
                          OK
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Cancelar"
                          onClick={() => setAliasingId(null)}
                        >
                          <X />
                        </Button>
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
                          <Button
                            variant="link"
                            size="xs"
                            className="ml-1 text-muted-foreground"
                            onClick={() => {
                              setAliasingId(p.id);
                              setAliasValue(p.paymentAlias ?? '');
                            }}
                          >
                            {p.paymentAlias ? 'Cambiar' : 'Agregar'}
                          </Button>
                        )}
                      </p>
                    )}
                  </div>

                  {!isArchived && (
                    <div className="ml-2 flex gap-2">
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground"
                        onClick={() => {
                          setRenamingId(p.id);
                          setRenameValue(p.name);
                        }}
                      >
                        Renombrar
                      </Button>
                      {canRemove && p.id !== myId && (
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-destructive"
                          onClick={async () => {
                            const ok = await confirm({
                              title: `¿Quitar a ${p.name}?`,
                              confirmLabel: 'Quitar',
                              destructive: true,
                            });
                            if (ok) remove.mutate({ participantId: p.id });
                          }}
                          loading={remove.isPending}
                        >
                          Quitar
                        </Button>
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
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            required
            placeholder="Nombre (sin cuenta)"
            aria-label="Nombre de la persona sin cuenta"
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon-lg"
            aria-label="Agregar persona"
            loading={addParticipant.isPending}
          >
            <Plus />
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </Page>
  );
}
