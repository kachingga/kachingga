import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { signOut, useSession } from '@/lib/auth';
import { ErrorState } from '@/components/error-state';
import { useTRPC } from '@/lib/trpc';

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

  async function handleSignOut() {
    await signOut();
    void navigate('/login');
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-muted-foreground">
          ←
        </button>
        <h1 className="text-xl font-bold">Mi cuenta</h1>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl bg-card p-4">
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="mt-1 font-medium">{session?.user.email ?? '—'}</p>
        </div>

        <div className="rounded-2xl bg-card p-4">
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
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {aliasError && <p className="text-sm text-destructive">{aliasError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => updateProfile.mutate({ paymentAlias: aliasInput || null })}
                  disabled={updateProfile.isPending}
                  className="flex-1 rounded-lg bg-primary py-2 font-medium text-primary-foreground disabled:opacity-50"
                >
                  {updateProfile.isPending ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={() => setEditingAlias(false)}
                  className="flex-1 rounded-lg border border-input py-2 text-foreground"
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
          className="w-full rounded-lg border border-destructive/40 py-3 text-destructive"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
