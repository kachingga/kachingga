import { cn } from 'cn';

import { CategoryIcon } from '@/components/kit';

export type PickableCategory = { id: string; name: string; icon: string; color: string };

/**
 * Pick one of the group's categories (expense form): each one with its icon and color, as a
 * radio group (keyboard and screen readers treat it as one choice).
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
  label = 'Categoría',
}: {
  categories: PickableCategory[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {categories.map((c) => {
        const checked = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(c.id)}
            className={cn(
              'press flex items-center gap-2 rounded-xl border py-1.5 pr-3 pl-1.5 text-sm font-medium transition-colors',
              checked
                ? 'border-primary bg-accent text-accent-foreground ring-2 ring-primary/30'
                : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            <CategoryIcon
              icon={c.icon}
              color={c.color}
              className="size-7 rounded-lg [&_svg]:size-4"
            />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
