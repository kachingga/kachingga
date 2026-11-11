import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { cn } from 'cn';

import { refreshSession, requestEmailChange, useSession } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { LogoMark } from '@/components/app-shell';
import { ErrorState } from '@/components/error-state';
import { Card, Field, Page, PageHeader, SectionTitle } from '@/components/kit';
import { MailSent } from '@/components/mail-sent';
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

const emailFormat = z.email();

/**
 * The account's email and "Cambiar": Supabase sends a mail to the current address and another to the
 * new one, and changes it once both links are opened (/cambiar-email, src/routes/change-email.tsx).
 * While the change is pending (Supabase keeps it in the session), says so.
 */
function EmailCard() {
  const session = useSession();
  const email = session?.user.email;
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const pendingInSession = session?.user.new_email;
  // Unless it already changed (`email` is the new one).
  const pending = (sentTo === email ? null : sentTo) ?? pendingInSession;

  // The links can be opened in another browser (on the iPhone the mails open in Safari, not in the
  // installed app): with a change pending, ask Supabase whether it already happened, so the email
  // shown here is the real one.
  useEffect(() => {
    if (pendingInSession && onlineManager.isOnline()) void refreshSession();
  }, [pendingInSession]);

  function startEdit() {
    setNewEmail('');
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = newEmail.trim();
    if (!emailFormat.safeParse(next).success) return setError('Ese email no es válido.');
    // Supabase keeps emails in lowercase.
    if (next.toLowerCase() === email?.toLowerCase()) return setError('Ese ya es tu email.');
    setError(null);
    setSending(true);
    const { error: authError } = await requestEmailChange(next);
    setSending(false);
    if (authError)
      return setError(
        authError.code === 'email_exists'
          ? 'Ya hay otra cuenta con ese email.'
          : authErrorMessage(authError),
      );
    setSentTo(next.toLowerCase());
    setEditing(false);
  }

  return (
    <Card>
      <p className="text-sm text-muted-foreground">Email</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="font-medium break-all">{email ?? '—'}</p>
        {email && !editing && (
          <Button variant="link" size="sm" onClick={startEdit} aria-label="Cambiar email">
            Cambiar
          </Button>
        )}
      </div>

      {editing && (
        <form onSubmit={handleSubmit} noValidate className="mt-3 space-y-3">
          <Field label="Email nuevo" htmlFor="new-email">
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="vos@mail.com"
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Te vamos a mandar un mail a tu email actual y otro al nuevo: el cambio se hace cuando
            confirmes desde los dos.
          </p>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={sending}>
              {sending ? 'Enviando…' : 'Cambiar email'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {pending && !editing && (
        <div className="mt-3">
          <MailSent>
            Te mandamos un mail a <strong className="break-all">{email}</strong> y otro a{' '}
            <strong className="break-all">{pending}</strong>: confirmá desde los dos para que se
            haga el cambio.
          </MailSent>
        </div>
      )}
    </Card>
  );
}

export function Account() {
  const navigate = useNavigate();
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
        <EmailCard />

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

        {/* Asks to confirm it's you first: src/routes/delete-account.tsx */}
        <Button variant="destructive" className="w-full" asChild>
          <Link to="/cuenta/borrar">Borrar mi cuenta</Link>
        </Button>
      </div>
    </Page>
  );
}
