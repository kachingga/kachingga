import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ArrowRight } from 'lucide-react';

import { AuthLayout, TermsNotice } from '@/components/auth-layout';
import { EmailLinkChoice } from '@/components/email-link-choice';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Field } from '@/components/kit';
import { ConfirmEmailSent } from '@/components/mail-sent';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirmEmail, signIn, useSession } from '@/lib/auth';
import { authErrorMessage, googleErrorMessage } from '@/lib/auth-errors';
import { useEmailLink } from '@/lib/email-link';
import { useReturnTo, withReturnTo } from '@/lib/return-to';
import { useCaptcha } from '@/lib/use-captcha';

export function Login() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [searchParams] = useSearchParams();
  const googleError = searchParams.get('google');
  const session = useSession();
  // The link of the confirmation mail comes here (src/lib/auth.ts → signUp).
  const emailLink = useEmailLink(confirmEmail, session);
  const captcha = useCaptcha();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await signIn(email, password, captcha.token);
    setLoading(false);
    if (!authError) return void navigate(returnTo, { replace: true });
    captcha.reset();
    if (authError.code === 'email_not_confirmed') setUnconfirmed(true);
    else setError(authErrorMessage(authError));
  }

  if (emailLink.status === 'ask')
    return (
      <EmailLinkChoice
        email={session?.user.email}
        onContinue={emailLink.proceed}
        onStay={emailLink.stay}
      />
    );

  // Email confirmed, or already logged in (confirming logs in and remounts the whole app, so this
  // screen can come back without the token, or with it while its answer arrives): on to where it
  // was going.
  if (emailLink.status === 'verified' || (session && emailLink.status !== 'verifying'))
    return <Navigate to={returnTo} replace />;

  if (unconfirmed)
    return (
      <AuthLayout
        title="Confirmá tu email"
        subtitle="Antes de entrar, confirmá que el email es tuyo."
      >
        <ConfirmEmailSent email={email} returnTo={returnTo}>
          <Button
            type="button"
            variant="link"
            className="w-full"
            onClick={() => setUnconfirmed(false)}
          >
            Ya lo confirmé, volver a entrar
          </Button>
        </ConfirmEmailSent>
      </AuthLayout>
    );

  return (
    <AuthLayout title="Qué bueno verte" subtitle="Entrá a tu cuenta.">
      {emailLink.status === 'verifying' && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Confirmando tu email…
        </p>
      )}
      {emailLink.status === 'invalid' && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          El link para confirmar tu email venció o ya se usó. Si ya lo confirmaste, entrá con tu
          email y contraseña.
        </p>
      )}
      {/* Google came back with an error (RequireAuth sends it here), e.g. sign-ups closed. */}
      {googleError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {googleErrorMessage(googleError)}
        </p>
      )}

      <GoogleSignIn returnTo={returnTo} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            placeholder="vos@mail.com"
          />
        </Field>

        <Field label="Contraseña" htmlFor="password">
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Link
            to="/recuperar-contrasena"
            className="ml-auto block w-fit py-1 text-sm font-semibold text-primary-ink hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </Field>

        {captcha.widget}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          loading={loading}
          disabled={captcha.waiting}
          size="lg"
          className="w-full"
        >
          {loading ? 'Entrando…' : 'Dale, entremos'}
          {!loading && <ArrowRight aria-hidden />}
        </Button>
      </form>

      <TermsNotice />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Primera vez por acá?{' '}
        <Link
          to={withReturnTo('/registro', returnTo)}
          className="font-semibold text-primary-ink hover:underline"
        >
          Creá tu cuenta
        </Link>
      </p>
    </AuthLayout>
  );
}
