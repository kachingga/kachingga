import type { ReactNode } from 'react';

import { ThemeToggle } from '@/components/app-shell';

/**
 * Login / register frame: green hero on the left on wide screens, the form on the right. The brand
 * is the page's h1: in the hero on wide screens, above the form on phones (only one is visible).
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
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-hero p-12 text-primary-foreground lg:flex dark:text-foreground">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          <img src="/logo.svg" alt="" className="size-9 rounded-lg" />
          Kachingga
        </h1>
        <div className="rise max-w-md">
          <p className="font-display text-5xl leading-[1.05] font-bold">
            Las cuentas claras conservan la amistad.
          </p>
          <p className="mt-5 text-lg opacity-80">
            Cargá los gastos del viaje, del depto o del asado. Kachingga te dice quién le transfiere
            a quién.
          </p>
        </div>
        <div className="rise w-72 rounded-2xl bg-background/10 p-4 backdrop-blur-sm [animation-delay:150ms]">
          <p className="text-xs tracking-wider uppercase opacity-70">Cómo quedar a mano</p>
          <p className="mt-2 font-display text-xl">
            Ana → Beto <span className="text-highlight">$ 7.775</span>
          </p>
        </div>
      </section>

      <section className="flex min-h-dvh flex-col px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-6 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 font-display text-xl font-bold lg:invisible">
            <img src="/logo.svg" alt="" className="size-8 rounded-lg" />
            Kachingga
          </h1>
          <ThemeToggle />
        </div>
        <div className="rise mx-auto my-auto w-full max-w-sm py-10">
          <h2 className="text-3xl font-bold">{title}</h2>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}
