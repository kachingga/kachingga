import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { signOut, useSession } from '@/lib/auth';
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
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-neutral-500">
          ←
        </button>
        <h1 className="text-xl font-bold">Mi cuenta</h1>
      </div>

      <div className="space-y-6">
        <div>
          <p className="text-sm text-neutral-500">Email</p>
          <p className="font-medium">{session?.user.email ?? '—'}</p>
        </div>

        <div>
          <p className="mb-1 text-sm text-neutral-500">Alias / CVU para cobrar</p>

          {profile.isPending && <p className="text-neutral-400">Cargando…</p>}

          {profile.isError && <p className="text-sm text-red-600">{profile.error.message}</p>}

          {profile.isSuccess && !editingAlias && (
            <div className="flex items-center justify-between">
              <p className="font-medium">{profile.data.paymentAlias ?? 'Sin alias'}</p>
              <button onClick={startEdit} className="text-sm text-neutral-500 underline">
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
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-black"
              />
              {aliasError && <p className="text-sm text-red-600">{aliasError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => updateProfile.mutate({ paymentAlias: aliasInput || null })}
                  disabled={updateProfile.isPending}
                  className="flex-1 rounded-lg bg-black py-2 font-medium text-white disabled:opacity-50"
                >
                  {updateProfile.isPending ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  onClick={() => setEditingAlias(false)}
                  className="flex-1 rounded-lg border border-neutral-300 py-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <p className="mt-1 text-xs text-neutral-400">
            Se usa en todos tus grupos para recibir transferencias.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full rounded-lg border border-red-200 py-3 text-red-600"
        >
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
