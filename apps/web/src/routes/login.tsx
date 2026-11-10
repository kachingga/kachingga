import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';

import { AuthLayout } from '@/components/auth-layout';
import { GoogleSignIn } from '@/components/google-sign-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from '@/lib/auth';
import { useReturnTo, withReturnTo } from '@/lib/return-to';

export function Login() {
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: authError } = await signIn(email, password);
    setLoading(false);
    if (authError) setError(authError.message);
    else void navigate(returnTo, { replace: true });
  }

  return (
    <AuthLayout title="¡Hola de nuevo!" subtitle="Entrá para ver cómo vienen tus cuentas.">
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
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full text-base">
          {loading ? 'Entrando…' : 'Entrar'}
          {!loading && <ArrowRight aria-hidden />}
        </Button>
      </form>

      <GoogleSignIn returnTo={returnTo} />

      <p className="mt-8 text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{' '}
        <Link
          to={withReturnTo('/registro', returnTo)}
          className="font-semibold text-primary hover:underline"
        >
          Crear cuenta
        </Link>
      </p>
    </AuthLayout>
  );
}
