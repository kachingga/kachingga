import { useId, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { cn } from 'cn';
import { LogOut, Moon, Sun, UserRound, Users } from 'lucide-react';

import { AnimatedLayout } from '@/components/animated-layout';
import { Button } from '@/components/ui/button';
import { setTheme, useTheme } from '@/lib/theme';
import { useSignOut } from '@/lib/use-sign-out';

/**
 * The logo (a coin split in two) in the palette's colors (`--logo-*`, index.css). Same drawing as
 * `public/logo.svg`, which the app icons come from (those stay green: they're generated once).
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={cn('size-8 shrink-0', className)}>
      <defs>
        <clipPath id={`${id}l`}>
          <polygon points="0,0 300,0 212,512 0,512" />
        </clipPath>
        <clipPath id={`${id}r`}>
          <polygon points="324,0 512,0 512,512 236,512" />
        </clipPath>
      </defs>
      <rect width="512" height="512" rx="112" className="fill-logo-bg" />
      <g clipPath={`url(#${id}l)`} transform="translate(-14 6)">
        <circle cx="256" cy="256" r="164" className="fill-logo-a" />
      </g>
      <g clipPath={`url(#${id}r)`} transform="translate(14 -6)">
        <circle cx="256" cy="256" r="164" className="fill-logo-b" />
      </g>
    </svg>
  );
}

/** "Kachingga." with the peach dot, after the logo. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-display text-2xl font-extrabold', className)}>
      <LogoMark />
      <span>
        Kachingga<span className="text-highlight">.</span>
      </span>
    </span>
  );
}

/** The wordmark, linking to "Mis grupos". */
export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/grupos" className="inline-flex">
      <Wordmark className={className} />
    </Link>
  );
}

export function ThemeToggle() {
  const theme = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      onClick={() => setTheme(next)}
      aria-label={next === 'dark' ? 'Usar modo oscuro' : 'Usar modo claro'}
    >
      {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </Button>
  );
}

function NavItem({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'press flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-sidebar-accent',
          isActive ? 'bg-accent text-primary-ink' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}

/**
 * Frame of every logged-in screen: sidebar on wide screens (lg), sticky header on phones. Each
 * screen sets its own width with `<Page>` (src/components/kit.tsx).
 */
export function AppShell() {
  const signOut = useSignOut();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar px-5 py-8 lg:flex">
        <Logo />
        <p className="mt-2 text-xs text-muted-foreground">Cuentas claras. Amistades intactas.</p>
        <nav aria-label="Principal" className="mt-12 flex flex-col gap-2 text-sm font-semibold">
          <NavItem to="/grupos" icon={<Users className="size-5" />}>
            Mis grupos
          </NavItem>
          <NavItem to="/cuenta" icon={<UserRound className="size-5" />}>
            Mi cuenta
          </NavItem>
        </nav>
        <div className="mt-auto flex items-center justify-between border-t pt-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 font-normal text-muted-foreground"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
            Salir
          </Button>
          <ThemeToggle />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Its own view-transition-name: stays still, above the screen that slides (index.css). */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur [view-transition-name:app-header] lg:hidden">
          <Logo className="text-xl" />
          <div className="flex items-center gap-1">
            <Link
              to="/cuenta"
              aria-label="Mi cuenta"
              className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <UserRound className="size-[18px]" />
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="overflow-x-clip pt-6 pb-[calc(env(safe-area-inset-bottom)+7rem)] lg:pt-10 lg:pb-16">
          {/* The side padding goes inside: the screen that slides is as wide as `main`. */}
          <AnimatedLayout className="px-5 sm:px-8 lg:px-10" />
        </main>
      </div>
    </div>
  );
}
