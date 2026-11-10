import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from 'cn';
import { ArrowLeft, Shapes, type LucideIcon } from 'lucide-react';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  colorForId,
  type CategoryColor,
  type CategoryIconName,
} from '@/lib/categories';
import { Label } from '@/components/ui/label';
import { formatCentsParts, formatMyBalance } from '@/lib/format';

// Visual building blocks of the design (palette "yerba y durazno"). Only presentation: no data.
// How they're used: docs/claude/web/componentes-y-tema.md.

/** Rounded card with a flat "sticker" edge below: the base surface of every screen. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-lg border bg-card p-5 text-card-foreground shadow-sticker', className)}
      {...props}
    />
  );
}

/** Section title inside a card or a column. */
export function SectionTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-bold', className)} {...props} />;
}

/** A category's icon in its color, on a soft background of that color. Unknown values fall back to "shapes" on cocoa. */
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
        'grid size-10 shrink-0 place-items-center rounded-lg',
        CATEGORY_COLORS[color as CategoryColor] ?? CATEGORY_COLORS.cocoa,
        className,
      )}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}

/**
 * Initial of a person or group in its own color: one of the 12 category colors, picked from its
 * `id` (the same person always has the same color). Theme tokens, never fixed colors.
 */
export function Avatar({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold ring-2 ring-card',
        CATEGORY_COLORS[colorForId(id)],
        className,
      )}
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

/** The faces of a group: up to 5 overlapping avatars and "+N" for the rest (decorative). */
export function AvatarStack({
  people,
  className,
}: {
  people: { id: string; name: string }[];
  className?: string;
}) {
  const extra = people.length - 5;
  return (
    <div aria-hidden className={cn('flex items-center -space-x-2', className)}>
      {people.slice(0, 5).map((p) => (
        <Avatar key={p.id} id={p.id} name={p.name} className="size-8 text-xs" />
      ))}
      {extra > 0 && (
        <span className="grid size-8 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-card">
          +{extra}
        </span>
      )}
    </div>
  );
}

/** A big amount: display font, with the cents smaller ("$ 12.500" + ",50"). */
export function Money({
  cents,
  currency,
  className,
}: {
  cents: number;
  currency: string;
  className?: string;
}) {
  const { whole, fraction } = formatCentsParts(cents, currency);
  return (
    <span className={cn('font-display font-bold whitespace-nowrap tabular', className)}>
      {whole}
      {fraction && <span className="text-[0.55em]">{fraction}</span>}
    </span>
  );
}

/** Nothing to show yet: an icon, what goes here and (as `children`) the action to start. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rise flex flex-col items-center py-10 text-center', className)}>
      <Icon aria-hidden className="mb-4 size-9 text-muted-foreground" />
      <p className="font-display text-xl font-bold">{title}</p>
      {description && (
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
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

/** A labeled form field: `<Label>` on top of its control (`Input`, `NativeSelect`, `NumberInput`…). */
export function Field({
  label,
  htmlFor,
  small,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  /** Smaller, muted label (dense forms like filters). */
  small?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className={small ? 'text-xs text-muted-foreground' : undefined}>
        {label}
      </Label>
      {children}
    </div>
  );
}

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
