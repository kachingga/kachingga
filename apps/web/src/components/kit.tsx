import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from 'cn';
import {
  ArrowLeft,
  BedDouble,
  Car,
  PartyPopper,
  Shapes,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Zap,
} from 'lucide-react';
import { formatMyBalance, type ExpenseCategory } from '@/lib/format';

// Visual building blocks of the design (palette "yerba y durazno"). Only presentation: no data.
// How they're used: docs/claude/web/componentes-y-tema.md.

/** Rounded card with a soft shadow: the base surface of every screen. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-2xl border bg-card p-5 text-card-foreground shadow-soft', className)}
      {...props}
    />
  );
}

/** Section title inside a card or a column. */
export function SectionTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-bold', className)} {...props} />;
}

const CATEGORY_ICONS: Record<ExpenseCategory, typeof Utensils> = {
  FOOD: Utensils,
  GROCERIES: ShoppingCart,
  TRANSPORT: Car,
  LODGING: BedDouble,
  ENTERTAINMENT: PartyPopper,
  SHOPPING: ShoppingBag,
  SERVICES: Zap,
  OTHER: Shapes,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: ExpenseCategory;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[category] ?? Shapes;
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground',
        className,
      )}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}

/** Initial of a person or group, on a theme color (never fixed colors). */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full bg-secondary font-display text-sm font-semibold text-secondary-foreground ring-2 ring-background',
        className,
      )}
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

/** "Te deben $X" (green) / "Debés $X" (terracotta) / "Estás al día" (muted), in one text node. */
export function MyBalance({
  cents,
  currency,
  className,
}: {
  cents: number;
  currency: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'tabular',
        cents > 0 ? 'text-positive' : cents < 0 ? 'text-negative' : 'text-muted-foreground',
        className,
      )}
    >
      {formatMyBalance(cents, currency)}
    </span>
  );
}

/** Screen header: optional back link, title, subtitle and actions (right on wide screens). */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { to: string; label: string } | { onClick: () => void; label: string };
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rise', className)}>
      {back &&
        ('to' in back ? (
          <Link
            to={back.to}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {back.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={back.onClick}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {back.label}
          </button>
        ))}
      <div
        className={cn('flex flex-wrap items-end justify-between gap-3', back ? 'mt-3' : undefined)}
      >
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold lg:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Width of a screen's content: forms and lists are narrow, the group screen uses the whole width. */
export function Page({ wide, className, ...props }: ComponentProps<'div'> & { wide?: boolean }) {
  return (
    <div
      className={cn('mx-auto w-full space-y-6', wide ? 'max-w-6xl' : 'max-w-2xl', className)}
      {...props}
    />
  );
}

/** Classes for native fields (`<select>`, date inputs) so they look like `<Input>`. */
export const fieldClass =
  'h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30';

/** Small pill buttons for choices (split type, currency mode, filters). */
export function Chip({
  active,
  className,
  ...props
}: ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'press rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted',
        className,
      )}
      {...props}
    />
  );
}
