import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';

import { AuthLayout } from '@/components/auth-layout';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Field } from '@/components/kit';
import { ConfirmEmailSent } from '@/components/mail-sent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signUp } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { useReturnTo, withReturnTo } from '@/lib/return-to';
import { useCaptcha } from '@/lib/use-captcha';

export function Register() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const captcha = useCaptcha();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError(null);
    setLoading(true);
    const { data, error: authError } = await signUp(email, password, {
      returnTo,
      captchaToken: captcha.token,
    });
    setLoading(false);
    if (authError) {
      captcha.reset();
      setError(authErrorMessage(authError));
    }
    // "Confirm email" on in Supabase: no session until the mail's link is opened.
    else if (!data.session) setSentTo(email);
    else void navigate(returnTo, { replace: true });
  }

  if (sentTo)
    return (
      <AuthLayout title="Revisá tu mail" subtitle="Falta un paso para crear tu cuenta.">
        <ConfirmEmailSent email={sentTo} returnTo={returnTo} justSent>
          <p className="pt-2 text-center text-sm text-muted-foreground">
            ¿Ya lo confirmaste o ya tenías cuenta?{' '}
            <Link
              to={withReturnTo('/login', returnTo)}
              className="font-semibold text-primary-ink hover:underline"
            >
              Entrá
            </Link>
          </p>
        </ConfirmEmailSent>
      </AuthLayout>
    );

  return (
    <AuthLayout title="Creá tu cuenta" subtitle="Empezá a organizar tus gastos compartidos.">
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
            autoComplete="new-password"
          />
        </Field>

        <Field label="Confirmar contraseña" htmlFor="confirm">
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
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
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          {!loading && <ArrowRight aria-hidden />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link
          to={withReturnTo('/login', returnTo)}
          className="font-semibold text-primary-ink hover:underline"
        >
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
