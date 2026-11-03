import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { signIn } from '@/lib/auth';

export function Login() {
  const navigate = useNavigate();
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
    else void navigate('/grupos');
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <h1 className="mb-2 text-3xl font-bold">Kachingga</h1>
      <p className="mb-8 text-neutral-400">Iniciá sesión para continuar</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-400" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-400" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white py-3 font-medium text-black disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-400">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="font-medium text-white underline">
          Crear cuenta
        </Link>
      </p>
    </main>
  );
}
