import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from 'cn';
import {
  ArrowLeft,
  Baby,
  Beer,
  BedDouble,
  Book,
  Briefcase,
  Bus,
  Car,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Music,
  PartyPopper,
  PawPrint,
  Pill,
  Pizza,
  Plane,
  Shapes,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  Sun,
  Ticket,
  TreePine,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import type { categoryColors, categoryIcons } from '@kachingga/api/schemas';
import { formatMyBalance } from '@/lib/format';

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

export type CategoryIconName = (typeof categoryIcons)[number];
export type CategoryColor = (typeof categoryColors)[number];

/** Every icon a category can have (`categoryIcons` in the API): the name → its lucide component. */
export const CATEGORY_ICONS: Record<CategoryIconName, typeof Utensils> = {
  utensils: Utensils,
  'shopping-cart': ShoppingCart,
  car: Car,
  'bed-double': BedDouble,
  'party-popper': PartyPopper,
  'shopping-bag': ShoppingBag,
  zap: Zap,
  shapes: Shapes,
  fuel: Fuel,
  plane: Plane,
  bus: Bus,
  home: Home,
  gift: Gift,
  heart: Heart,
  coffee: Coffee,
  beer: Beer,
  pizza: Pizza,
  shirt: Shirt,
  'gamepad-2': Gamepad2,
  music: Music,
  film: Film,
  ticket: Ticket,
  dumbbell: Dumbbell,
  'paw-print': PawPrint,
  baby: Baby,
  'graduation-cap': GraduationCap,
  stethoscope: Stethoscope,
  pill: Pill,
  wifi: Wifi,
  smartphone: Smartphone,
  book: Book,
  briefcase: Briefcase,
  wrench: Wrench,
  'tree-pine': TreePine,
  sun: Sun,
  wallet: Wallet,
};

/**
 * Every color a category can have (`categoryColors` in the API): a soft background and the color
 * itself, always theme variables (they adapt to light and dark). Full class names so Tailwind sees them.
 */
export const CATEGORY_COLORS: Record<CategoryColor, string> = {
  'chart-1': 'bg-chart-1/15 text-chart-1',
  'chart-2': 'bg-chart-2/20 text-chart-2',
  'chart-3': 'bg-chart-3/15 text-chart-3',
  'chart-4': 'bg-chart-4/15 text-chart-4',
  'chart-5': 'bg-chart-5/20 text-chart-5',
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  highlight: 'bg-highlight/25 text-highlight-foreground',
  primary: 'bg-primary/15 text-primary',
  muted: 'bg-muted text-muted-foreground',
};

/** A category's icon on its color. Unknown values (old data) fall back to "shapes" on muted. */
export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon: string;
  color: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[icon as CategoryIconName] ?? Shapes;
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl',
        CATEGORY_COLORS[color as CategoryColor] ?? CATEGORY_COLORS.muted,
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
