import { cn } from 'cn';
import { Shapes } from 'lucide-react';

import {
  CATEGORY_COLORS,
  CATEGORY_COLORS_STRONG,
  CATEGORY_ICONS,
  type CategoryColor,
  type CategoryIconName,
} from '@/lib/categories';

export type PickableCategory = { id: string; name: string; icon: string; color: string };

/**
 * Pick one of the group's categories (expense form): a chip in each category's color with its icon
 * and name (the picked one, filled with its color), as a radio group (keyboard and screen readers
 * treat it as one choice).
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
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {categories.map((c) => {
        const checked = c.id === value;
        const color = (c.color in CATEGORY_COLORS ? c.color : 'cocoa') as CategoryColor;
        const Icon = CATEGORY_ICONS[c.icon as CategoryIconName] ?? Shapes;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(c.id)}
            className={cn(
              'press flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold',
              checked
                ? cn(CATEGORY_COLORS_STRONG[color], 'ring-2 ring-offset-2 ring-offset-card')
                : CATEGORY_COLORS[color],
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
