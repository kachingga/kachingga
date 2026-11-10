import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';

import { AuthLayout } from '@/components/auth-layout';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Field } from '@/components/kit';
import { ConfirmEmailSent } from '@/components/mail-sent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirmEmail, signIn } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { useEmailLink } from '@/lib/email-link';
import { useReturnTo, withReturnTo } from '@/lib/return-to';
import { useCaptcha } from '@/lib/use-captcha';

export function Login() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  // The link of the confirmation mail comes here (src/lib/auth.ts → signUp).
  const emailLink = useEmailLink(confirmEmail);
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

  // Email confirmed and logged in: on to where it was going.
  if (emailLink === 'verified') return <Navigate to={returnTo} replace />;

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
      {emailLink === 'verifying' && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Confirmando tu email…
        </p>
      )}
      {emailLink === 'invalid' && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          El link para confirmar tu email venció o ya se usó. Si ya lo confirmaste, entrá con tu
          email y contraseña.
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
          <Input
            id="password"
            type="password"
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
