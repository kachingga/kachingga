import type { ReactNode } from 'react';
import { Heart } from 'lucide-react';

import { ThemeToggle, Wordmark } from '@/components/app-shell';

/**
 * Login / register frame: cream background with faint split coins, the brand (the page's h1) and
 * the form. Side by side on wide screens, one above the other on phones.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 coin-pattern text-primary-ink opacity-[0.045] dark:opacity-[0.05]"
      />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-5 sm:px-10">
        <Wordmark />
        <ThemeToggle />
      </header>

      <main className="relative mx-auto grid max-w-5xl items-center gap-8 px-6 pt-2 pb-10 sm:px-10 lg:min-h-[640px] lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:pt-10">
        <section className="text-center lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            <Heart aria-hidden className="size-3.5" />
            Cuentas claras. Amistades intactas.
          </p>
          <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">
            Kachingga<span className="text-highlight">.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-sm leading-relaxed text-muted-foreground lg:mx-0">
            Compartí gastos. Organizá tus cuentas. Tené claro quién pagó y cuánto le toca a cada
            uno.
          </p>
        </section>

        <section className="rise mx-auto w-full max-w-sm">
          <h2 className="text-3xl font-bold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </section>
      </main>
    </div>
  );
}

const legalLink = 'font-semibold text-primary-ink hover:underline';

/**
 * Under the main button of login and register: continuing (with Google or the email) accepts the
 * terms and the privacy policy, both on the landing (CLAUDE.md → "Usuarios y login"). The transfer
 * to the US is named here because the law asks for that consent to be express and highlighted.
 */
export function TermsNotice() {
  return (
    <p className="mt-4 text-center text-xs text-muted-foreground">
      Al continuar aceptás los{' '}
      <a
        href="https://kachingga.com/terminos"
        target="_blank"
        rel="noopener noreferrer"
        className={legalLink}
      >
        Términos
      </a>{' '}
      y la{' '}
      <a
        href="https://kachingga.com/privacidad"
        target="_blank"
        rel="noopener noreferrer"
        className={legalLink}
      >
        Política de privacidad
      </a>
      , incluido que tus datos se guarden en Estados Unidos.
    </p>
  );
}
