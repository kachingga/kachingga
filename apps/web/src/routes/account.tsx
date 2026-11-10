import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cn } from 'cn';

import { useSession } from '@/lib/auth';
import { LogoMark } from '@/components/app-shell';
import { ErrorState } from '@/components/error-state';
import { Card, Page, PageHeader, SectionTitle } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTRPC } from '@/lib/trpc';
import { useSignOut } from '@/lib/use-sign-out';
import { PALETTES, setPalette, usePalette } from '@/lib/theme';

/**
 * The app's colors, saved on this device. Each option previews its palette (`data-palette` on the
 * option: the logo and the ring take its colors).
 */
function PalettePicker() {
  const palette = usePalette();
  return (
    <Card>
      <SectionTitle>Colores de la app</SectionTitle>
      <p className="mt-1 text-sm text-muted-foreground">Se guardan en este dispositivo.</p>
      <div
        role="radiogroup"
        aria-label="Colores de la app"
        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {PALETTES.map((p) => {
          const checked = p.id === palette;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={checked}
              data-palette={p.id}
              onClick={() => setPalette(p.id)}
              className={cn(
                'press flex min-h-14 items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left text-sm font-semibold',
                checked ? 'border-primary ring-2 ring-primary' : 'border-border hover:bg-muted',
              )}
            >
              <LogoMark />
              {p.name}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

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
    <Page>
      <PageHeader title="Mi cuenta" back={{ onClick: () => navigate(-1), label: 'Volver' }} />

      <div className="space-y-6">
        <Card>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="mt-1 font-medium">{session?.user.email ?? '—'}</p>
        </Card>

        <Card>
          <p className="mb-2 text-sm text-muted-foreground">Alias / CVU para cobrar</p>

          {profile.isPending && <p className="text-muted-foreground">Cargando…</p>}

          {profile.isError && (
            <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} />
          )}

          {profile.isSuccess && !editingAlias && (
            <div className="flex items-center justify-between">
              <p className="font-medium">{profile.data.paymentAlias ?? 'Sin alias'}</p>
              <Button variant="link" size="sm" onClick={startEdit}>
                {profile.data.paymentAlias ? 'Cambiar' : 'Agregar'}
              </Button>
            </div>
          )}

          {editingAlias && (
            <div className="space-y-2">
              <Input
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="alias.ejemplo o CVU de 22 dígitos"
                aria-label="Alias o CVU"
              />
              {aliasError && <p className="text-sm text-destructive">{aliasError}</p>}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => updateProfile.mutate({ paymentAlias: aliasInput || null })}
                  loading={updateProfile.isPending}
                >
                  {updateProfile.isPending ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setEditingAlias(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <p className="mt-2 text-xs text-muted-foreground">
            Se usa en todos tus grupos para recibir transferencias.
          </p>
        </Card>

        <PalettePicker />

        <Button variant="destructive" className="w-full" onClick={handleSignOut}>
          Cerrar sesión
        </Button>
      </div>
    </Page>
  );
}
