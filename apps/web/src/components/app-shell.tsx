import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { cn } from 'cn';
import { LogOut, Moon, Sun, UserRound, Users } from 'lucide-react';

import { AnimatedLayout } from '@/components/animated-layout';
import { Button } from '@/components/ui/button';
import { setTheme, useTheme } from '@/lib/theme';
import { useSignOut } from '@/lib/use-sign-out';

/** Logo + name. The icon is the same `public/logo.svg` the PWA icons come from. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/grupos"
      className={cn('flex items-center gap-2 font-display text-xl font-bold', className)}
    >
      <img src="/logo.svg" alt="" className="size-8 rounded-lg" />
      Kachingga
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
          'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-sidebar-accent',
          isActive ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/75',
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
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar p-5 lg:flex">
        <Logo />
        <nav aria-label="Principal" className="mt-10 flex flex-col gap-1 text-sm font-medium">
          <NavItem to="/grupos" icon={<Users className="size-4" />}>
            Mis grupos
          </NavItem>
          <NavItem to="/cuenta" icon={<UserRound className="size-4" />}>
            Mi cuenta
          </NavItem>
        </nav>
        <div className="mt-auto flex items-center justify-between">
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
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/85 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur lg:hidden">
          <Logo className="text-lg" />
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
        <main className="overflow-x-clip px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+7rem)] lg:px-10 lg:pt-10 lg:pb-16">
          <AnimatedLayout />
        </main>
      </div>
    </div>
  );
}
