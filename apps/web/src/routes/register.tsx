import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';

import { AuthLayout } from '@/components/auth-layout';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUp } from '@/lib/auth';
import { useReturnTo, withReturnTo } from '@/lib/return-to';

export function Register() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [email, setEmail] = useState('');
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
    const { error: authError } = await signUp(email, password);
    setLoading(false);
    if (authError) setError(authError.message);
    else void navigate(returnTo, { replace: true });
  }

  return (
    <AuthLayout title="Creá tu cuenta" subtitle="Es gratis y tarda un minuto.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
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
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirmar contraseña</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full text-base">
          {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          {!loading && <ArrowRight aria-hidden />}
        </Button>
      </form>

      <GoogleSignIn returnTo={returnTo} />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link
          to={withReturnTo('/login', returnTo)}
          className="font-semibold text-primary hover:underline"
        >
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
