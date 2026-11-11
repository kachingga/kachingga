import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { AuthLayout } from '@/components/auth-layout';
import { EmailLinkChoice } from '@/components/email-link-choice';
import { Field } from '@/components/kit';
import { PasswordInput } from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { updatePassword, useSession, verifyPasswordReset } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { useEmailLink } from '@/lib/email-link';
import { HOME } from '@/lib/return-to';

/**
 * Where the password-reset mail's link lands: the link logs in (`#token_hash=…`), and here the
 * person picks the new password and goes into the app. With Supabase's default template the link
 * comes with a PKCE `?code=` instead, which the library exchanges on load (only in the same browser).
 */
export function NewPassword() {
  const navigate = useNavigate();
  const session = useSession();
  const emailLink = useEmailLink(verifyPasswordReset, session);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await updatePassword(password);
    setLoading(false);
    if (authError) return setError(authErrorMessage(authError));
    toast.success('Listo, ya tenés tu contraseña nueva');
    void navigate(HOME, { replace: true });
  }

  if (emailLink.status === 'ask')
    return (
      <EmailLinkChoice
        email={session?.user.email}
        onContinue={emailLink.proceed}
        onStay={emailLink.stay}
      />
    );

  const checking =
    emailLink.status === 'verifying' || (emailLink.status === 'none' && session === undefined);
  const invalid =
    emailLink.status === 'invalid' || (emailLink.status === 'none' && session === null);

  if (checking)
    return (
      <AuthLayout title="Elegí tu contraseña nueva" subtitle="Un segundo…">
        <p role="status" className="text-sm text-muted-foreground">
          Revisando el link…
        </p>
      </AuthLayout>
    );

  if (invalid)
    return (
      <AuthLayout
        title="Este link ya no sirve"
        subtitle="Los links para cambiar la contraseña sirven una sola vez y vencen al rato."
      >
        <div className="space-y-2">
          <Button size="lg" className="w-full" asChild>
            <Link to="/recuperar-contrasena">Pedir otro link</Link>
          </Button>
          <Button variant="link" className="w-full" asChild>
            <Link to="/login">Volver a entrar</Link>
          </Button>
        </div>
      </AuthLayout>
    );

  return (
    <AuthLayout title="Elegí tu contraseña nueva" subtitle="Después entrás directo a la app.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Contraseña nueva" htmlFor="password">
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </Field>

        <Field label="Confirmar contraseña" htmlFor="confirm">
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" loading={loading} size="lg" className="w-full">
          {loading ? 'Guardando…' : 'Guardar y entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
