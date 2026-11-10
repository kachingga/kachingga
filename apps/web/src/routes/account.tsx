import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router';
import type { AppRouter } from '@kachingga/api';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { toast } from 'sonner';

import { cn } from 'cn';

import { useSession } from '@/lib/auth';
import { LogoMark } from '@/components/app-shell';
import { ErrorState } from '@/components/error-state';
import { Card, Page, PageHeader, SectionTitle } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCents } from '@/lib/format';
import { OFFLINE_MESSAGE } from '@/lib/offline-cache';
import { useTRPC } from '@/lib/trpc';
import { useConfirm } from '@/lib/use-confirm';
import { useSignOut } from '@/lib/use-sign-out';
import { PALETTES, setPalette, usePalette } from '@/lib/theme';

type MyGroups = inferRouterOutputs<AppRouter>['groups']['list'];

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

/**
 * What deleting the account means: I stay in my groups without account, with my name, and what I
 * leave pending in each one (balances computed by the API) stays there. Informs, doesn't block.
 */
function DeleteAccountDescription({ groups }: { groups: MyGroups }) {
  const names = [...new Set(groups.map((g) => g.myName))];
  const pending = groups.flatMap((g) =>
    g.myBalances.map((b) => ({ ...b, group: g.name, groupId: g.id })),
  );
  return (
    <div className="space-y-2">
      <p>
        {names.length > 0 && (
          <>
            En tus grupos vas a seguir apareciendo como{' '}
            {names.map((name, i) => (
              <Fragment key={name}>
                {i > 0 && (i === names.length - 1 ? ' o ' : ', ')}
                <strong className="font-semibold text-foreground">{name}</strong>
              </Fragment>
            ))}
            {names.length > 1 && ' (según el grupo)'}, sin cuenta; tus gastos y saldos quedan.{' '}
          </>
        )}
        Se borran tu alias y tus filtros guardados. No se puede deshacer.
      </p>
      {pending.length > 0 && (
        <ul className="space-y-1">
          {pending.map((b) => (
            <li key={`${b.groupId}-${b.currency}`}>
              En <strong className="font-semibold text-foreground">{b.group}</strong>{' '}
              {b.amountCents < 0
                ? `debés ${formatCents(-b.amountCents, b.currency)}: la deuda queda en el grupo.`
                : `te deben ${formatCents(b.amountCents, b.currency)}.`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Borrar mi cuenta": confirm with what stays pending, delete, then sign out like "Cerrar sesión". */
function DeleteAccountButton() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const signOut = useSignOut();
  const [checking, setChecking] = useState(false);

  const deleteAccount = useMutation(
    trpc.profile.deleteAccount.mutationOptions({
      onSuccess: async () => {
        await signOut();
        toast.success('Tu cuenta se borró');
      },
      onError: (err) => {
        toast.error(err.message);
        // It may be unlinked from its groups already (retrying finishes the job): show what's true.
        void queryClient.invalidateQueries();
      },
    }),
  );

  async function handleClick() {
    // Offline the query would wait for the network: say it now, like any other change.
    if (!onlineManager.isOnline()) return void toast.error(OFFLINE_MESSAGE);
    setChecking(true);
    // Fresh balances, archived groups included (debts there stay too).
    const groups = await queryClient
      .fetchQuery(trpc.groups.list.queryOptions({ includeArchived: true }))
      .catch((err: Error) => {
        toast.error(`No se pudieron revisar tus saldos: ${err.message}`);
        return null;
      })
      .finally(() => setChecking(false));
    if (!groups) return;

    const ok = await confirm({
      title: '¿Borrar tu cuenta?',
      description: <DeleteAccountDescription groups={groups} />,
      confirmLabel: 'Borrar mi cuenta',
      destructive: true,
    });
    if (ok) deleteAccount.mutate();
  }

  return (
    <Button
      variant="destructive"
      className="w-full"
      onClick={handleClick}
      loading={checking || deleteAccount.isPending}
    >
      {deleteAccount.isPending ? 'Borrando…' : 'Borrar mi cuenta'}
    </Button>
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

        <DeleteAccountButton />
      </div>
    </Page>
  );
}
