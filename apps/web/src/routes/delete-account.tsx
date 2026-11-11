import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { AppRouter } from '@kachingga/api';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import { toast } from 'sonner';

import { reauthenticateWithGoogle, signIn, useSession } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { ErrorState } from '@/components/error-state';
import { GoogleIcon } from '@/components/google-sign-in';
import { Card, Field, Page, PageHeader, SectionTitle } from '@/components/kit';
import { PasswordInput } from '@/components/password-input';
import { RowsSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/format';
import { OFFLINE_MESSAGE } from '@/lib/offline-cache';
import { rememberReturnToForGoogle } from '@/lib/return-to';
import { useTRPC } from '@/lib/trpc';
import { useCaptcha } from '@/lib/use-captcha';
import { useGoBack } from '@/lib/use-go-back';
import { useSignOut } from '@/lib/use-sign-out';

type MyGroups = inferRouterOutputs<AppRouter>['groups']['list'];

// Google comes back here (/cuenta/borrar) with this mark: "you just confirmed with Google, now delete".
const BACK_FROM_GOOGLE = '/cuenta/borrar?con=google';

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

/**
 * "Borrar mi cuenta" (from Mi cuenta): what happens and what I leave pending in each group, then
 * confirming it's me (the password again, or Google again) and deleting. The API deletes only right
 * after signing in again (`profile.deleteAccount`): a session left open isn't enough. Then signs out
 * like "Cerrar sesión".
 */
export function DeleteAccount() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const session = useSession();
  const goBack = useGoBack();
  const signOut = useSignOut();
  const captcha = useCaptcha();
  const [searchParams, setSearchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [leavingForGoogle, setLeavingForGoogle] = useState(false);

  // Fresh balances (refetched when the screen opens), archived groups included: debts there stay too.
  const groups = useQuery(trpc.groups.list.queryOptions({ includeArchived: true }));

  const email = session?.user.email;
  const providers = new Set(session?.user.identities?.map((i) => i.provider));
  const hasGoogle = providers.has('google');
  // Who signed up with Google has no password (unless they set one), even if they changed the email.
  const hasPassword = providers.has('email') || !hasGoogle;
  const backFromGoogle = searchParams.get('con') === 'google';

  const deleteAccount = useMutation(
    trpc.profile.deleteAccount.mutationOptions({
      onSuccess: async () => {
        await signOut();
        toast.success('Tu cuenta se borró');
      },
      onError: (err) => {
        toast.error(err.message);
        // Too long since Google (or the mark was typed by hand): confirm again.
        if (err.data?.code === 'FORBIDDEN') setSearchParams({}, { replace: true });
        // It may be unlinked from its groups already (retrying finishes the job): show what's true.
        void queryClient.invalidateQueries();
      },
    }),
  );

  /** Offline the request would wait for the network: say it now, like any other change. */
  function online() {
    if (onlineManager.isOnline()) return true;
    toast.error(OFFLINE_MESSAGE);
    return false;
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !online()) return;
    setError(null);
    setSigningIn(true);
    // Signing in again starts a new session that the API sees as recent (its `amr`).
    const { error: authError } = await signIn(email, password, captcha.token);
    setSigningIn(false);
    captcha.reset();
    if (authError)
      return setError(
        authError.code === 'invalid_credentials'
          ? 'La contraseña no es correcta.'
          : authErrorMessage(authError),
      );
    deleteAccount.mutate();
  }

  async function handleGoogle() {
    if (!online()) return;
    setError(null);
    setLeavingForGoogle(true);
    rememberReturnToForGoogle(BACK_FROM_GOOGLE);
    const { error: authError } = await reauthenticateWithGoogle();
    // On success the browser is already leaving for Google: keep the button disabled.
    if (authError) {
      setLeavingForGoogle(false);
      setError('No se pudo abrir Google. Probá de nuevo.');
    }
  }

  const deleting = signingIn || deleteAccount.isPending;
  const deleteLabel = deleting ? 'Borrando…' : 'Borrar mi cuenta';

  return (
    <Page>
      <PageHeader
        title="Borrar mi cuenta"
        back={{ onClick: () => goBack('/cuenta'), label: 'Mi cuenta' }}
      />

      {groups.isError && (
        <ErrorState
          message={`No se pudieron revisar tus saldos: ${groups.error.message}`}
          onRetry={() => groups.refetch()}
        />
      )}

      {(groups.isPending || session === undefined) && !groups.isError && <RowsSkeleton />}

      {groups.isSuccess && session && (
        <>
          <Card className="space-y-2 text-sm text-muted-foreground">
            <p>
              Vas a borrar la cuenta de{' '}
              <strong className="font-semibold break-all text-foreground">{email}</strong>.
            </p>
            <DeleteAccountDescription groups={groups.data} />
          </Card>

          <Card>
            <SectionTitle>Confirmá que sos vos</SectionTitle>

            {backFromGoogle ? (
              <>
                <p className="mt-1 text-sm text-muted-foreground">Ya confirmaste con Google.</p>
                <Button
                  variant="destructive"
                  className="mt-4 w-full"
                  loading={deleting}
                  onClick={() => online() && deleteAccount.mutate()}
                >
                  {deleteLabel}
                </Button>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasPassword && hasGoogle
                    ? 'Escribí tu contraseña o volvé a entrar con Google.'
                    : hasPassword
                      ? 'Escribí tu contraseña.'
                      : 'Volvé a entrar con Google.'}
                </p>

                {hasPassword && (
                  <form onSubmit={handlePassword} className="mt-4 space-y-4">
                    <Field label="Tu contraseña" htmlFor="current-password">
                      <PasswordInput
                        id="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                    </Field>
                    {captcha.widget}
                    <Button
                      type="submit"
                      variant="destructive"
                      className="w-full"
                      loading={deleting}
                      disabled={captcha.waiting || leavingForGoogle}
                    >
                      {deleteLabel}
                    </Button>
                  </form>
                )}

                {hasPassword && hasGoogle && (
                  <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />o
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}

                {hasGoogle && (
                  <Button
                    type="button"
                    variant="google"
                    className={hasPassword ? 'w-full gap-2.5' : 'mt-4 w-full gap-2.5'}
                    onClick={handleGoogle}
                    loading={leavingForGoogle}
                    disabled={deleting}
                  >
                    <GoogleIcon />
                    {leavingForGoogle ? 'Abriendo Google…' : 'Confirmar con Google'}
                  </Button>
                )}
              </>
            )}

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </Card>

          <Button variant="outline" className="w-full" onClick={() => goBack('/cuenta')}>
            Cancelar
          </Button>
        </>
      )}
    </Page>
  );
}
