import { useState } from 'react';
import { Link } from 'react-router';

import { AuthLayout } from '@/components/auth-layout';
import { Field } from '@/components/kit';
import { MailSent } from '@/components/mail-sent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestPasswordReset } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { useCaptcha } from '@/lib/use-captcha';

/** "¿Olvidaste tu contraseña?": sends the mail whose link opens /nueva-contrasena. */
export function ForgotPassword() {
  const captcha = useCaptcha();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await requestPasswordReset(email, captcha.token);
    setLoading(false);
    captcha.reset();
    if (authError) setError(authErrorMessage(authError));
    else setSentTo(email);
  }

  // Same message whether the account exists or not: it doesn't reveal who has one.
  if (sentTo)
    return (
      <AuthLayout title="Revisá tu mail" subtitle="Y elegí una contraseña nueva desde el link.">
        <MailSent>
          Si hay una cuenta con <strong className="break-all">{sentTo}</strong>, te llegó un mail
          con un link para elegir una contraseña nueva.
        </MailSent>
        <p className="mt-4 text-sm text-muted-foreground">
          ¿No te llegó? Fijate en spam o esperá un minuto y pedí otro.
        </p>
        <div className="mt-6 space-y-2">
          <Button variant="outline" size="lg" className="w-full" onClick={() => setSentTo(null)}>
            Pedir otro mail
          </Button>
          <Button variant="link" className="w-full" asChild>
            <Link to="/login">Volver a entrar</Link>
          </Button>
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout
      title="¿Olvidaste tu contraseña?"
      subtitle="Te mandamos un mail con un link para elegir una nueva."
    >
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

        {captcha.widget}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          loading={loading}
          disabled={captcha.waiting}
          size="lg"
          className="w-full"
        >
          {loading ? 'Mandando…' : 'Mandame el link'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Te acordaste?{' '}
        <Link to="/login" className="font-semibold text-primary-ink hover:underline">
          Entrá
        </Link>
      </p>
    </AuthLayout>
  );
}
