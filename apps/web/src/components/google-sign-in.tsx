import { useState } from 'react';

import { signInWithGoogle } from '@/lib/auth';

/** "Continuar con Google" + an "o" divider, for the login and register screens. */
export function GoogleSignIn() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const { error: authError } = await signInWithGoogle();
    // On success the browser is already leaving for Google: keep the button disabled.
    if (authError) {
      setLoading(false);
      setError('No se pudo entrar con Google. Probá de nuevo o usá tu email.');
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-card py-3 font-medium text-foreground disabled:opacity-50"
      >
        <GoogleIcon />
        {loading ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.98-4.3 2.98-7.35zM12 22c2.7 0 4.96-.9 6.62-2.42l-3.23-2.5c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.07v2.6A10 10 0 0 0 12 22zm-5.6-7.1a6 6 0 0 1 0-3.8V8.5H3.07a10 10 0 0 0 0 9zM12 5.98c1.47 0 2.79.5 3.83 1.5l2.86-2.87A10 10 0 0 0 3.07 8.5L6.4 11.1C7.19 8.74 9.4 5.98 12 5.98z" />
    </svg>
  );
}
