import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { useSession } from '@/lib/auth';
import { ErrorState } from '@/components/error-state';
import { useTRPC } from '@/lib/trpc';
import { useSignOut } from '@/lib/use-sign-out';

export function Account() {
  const navigate = useNavigate();
  const session = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const profile = useQuery(trpc.profile.get.queryOptions());
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasError, setAliasError] = useState<string | null>(null);

  const updateProfile = useMutation(
    trpc.profile.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.profile.pathFilter());
        setEditingAlias(false);
        setAliasError(null);
      },
      onError: (err) => setAliasError(err.message),
    }),
  );

  function startEdit() {
    setAliasInput(profile.data?.paymentAlias ?? '');
    setEditingAlias(true);
    setAliasError(null);
  }

  // Nothing of this account stays on the device (offline cache, memory).
  const handleSignOut = useSignOut();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rise flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="press grid size-9 shrink-0 place-items-center rounded-full text-lg text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-bold lg:text-3xl">Mi cuenta</h1>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="mt-1 font-medium">{session?.user.email ?? '—'}</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <p className="mb-2 text-sm text-muted-foreground">Alias / CVU para cobrar</p>

          {profile.isPending && <p className="text-muted-foreground">Cargando…</p>}

          {profile.isError && (
            <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />
          )}

          {profile.isSuccess && !editingAlias && (
            <div className="flex items-center justify-between">
              <p className="font-medium">{profile.data.paymentAlias ?? 'Sin alias'}</p>
              <button onClick={startEdit} className="text-sm text-muted-foreground underline">
                {profile.data.paymentAlias ? 'Cambiar' : 'Agregar'}
              </button>
            </div>
          )}

          {editingAlias && (
            <div className="space-y-2">
              <input
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="alias.ejemplo o CVU de 22 dígitos"
                className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              />
              {aliasError && <p className="text-sm text-destructive">{aliasError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => updateProfile.mutate({ paymentAlias: aliasInput || null })}
                  disabled={updateProfile.isPending}
                  className="press flex-1 rounded-full bg-primary py-2 font-semibold text-primary-foreground disabled:opacity-50 shadow-soft"
                >
                  {updateProfile.isPending ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={() => setEditingAlias(false)}
                  className="press flex-1 rounded-full border border-input py-2 text-foreground bg-card"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            Se usa en todos tus grupos para recibir transferencias.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="press w-full rounded-full border border-destructive/40 py-3 text-destructive bg-card"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
