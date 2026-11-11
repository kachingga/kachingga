import { Link, Navigate } from 'react-router';

import { AuthLayout } from '@/components/auth-layout';
import { EmailLinkChoice } from '@/components/email-link-choice';
import { MailSent } from '@/components/mail-sent';
import { Button } from '@/components/ui/button';
import { useSession, verifyEmailChange } from '@/lib/auth';
import { useEmailLinkResult } from '@/lib/email-link';

/**
 * Where the links of the email-change mails land (one to the current address, one to the new one:
 * Supabase's "secure email change"). Public: it works with or without a session in this browser (on
 * the iPhone the mail opens in Safari, not in the installed app). The first link confirms its address;
 * the second one changes the email and logs in, which remounts the app (`useEmailLinkResult` keeps
 * the answer).
 */
export function ChangeEmail() {
  const session = useSession();
  const { status, result, proceed, stay } = useEmailLinkResult(verifyEmailChange, session);

  // Nothing to confirm here (e.g. reloaded after confirming): the email is in Mi cuenta.
  if (status === 'none') return <Navigate to="/cuenta" replace />;

  // Logged in: the person says first whether to use the link (one more tap).
  if (status === 'ask')
    return <EmailLinkChoice email={session?.user.email} onContinue={proceed} onStay={stay} />;

  if (status === 'verifying')
    return (
      <AuthLayout title="Cambiar tu email" subtitle="Un segundo…">
        <p role="status" className="text-sm text-muted-foreground">
          Revisando el link…
        </p>
      </AuthLayout>
    );

  const next = session ? (
    <Button size="lg" className="w-full" asChild>
      <Link to="/cuenta">Ir a Mi cuenta</Link>
    </Button>
  ) : (
    <Button size="lg" className="w-full" asChild>
      <Link to="/login">Entrar</Link>
    </Button>
  );

  if (status === 'invalid')
    return (
      <AuthLayout
        title="Este link ya no sirve"
        subtitle="Los links para cambiar el email sirven una sola vez y vencen al rato."
      >
        <p className="mb-6 text-sm text-muted-foreground">
          Si ya cambiaste tu email, no hace falta nada más. Si no, pedí el cambio de nuevo desde Mi
          cuenta.
        </p>
        {next}
      </AuthLayout>
    );

  // The second link answers with the session (the email already changed); the first one, without.
  const newEmail = result?.data.session ? result.data.user?.email : undefined;
  if (newEmail)
    return (
      <AuthLayout title="¡Listo!" subtitle="Ya cambiamos el email de tu cuenta.">
        <p className="mb-6">
          Tu email ahora es <strong className="break-all">{newEmail}</strong>.
        </p>
        {next}
      </AuthLayout>
    );

  return (
    <AuthLayout title="Falta un paso" subtitle="Listo, falta confirmar desde el otro mail.">
      <div className="mb-6">
        <MailSent>
          Para que se haga el cambio, tocá también el link del mail que te mandamos a la otra
          dirección. Hasta entonces, tu email sigue siendo el mismo.
        </MailSent>
      </div>
      {next}
    </AuthLayout>
  );
}
