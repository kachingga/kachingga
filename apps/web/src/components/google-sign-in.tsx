import { useState } from 'react';

import { signInWithGoogle } from '@/lib/auth';

/** An "o" divider + "Continuar con Google", under the email form of login and register. */
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
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="press flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-google-border bg-google px-3 text-sm font-medium text-google-foreground disabled:opacity-50"
      >
        <GoogleIcon />
        {loading ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}

// Google's brand colors: the only fixed colors in the app (their sign-in guidelines require them).
function GoogleIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}
