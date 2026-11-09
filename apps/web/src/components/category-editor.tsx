import { useState } from 'react';
import { cn } from 'cn';
import { categoryColors, categoryIcons } from '@kachingga/api/schemas';

import { CategoryIcon } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type CategoryColor,
  type CategoryIconName,
} from '@/lib/categories';

// Names screen readers say for each icon and color (the lists come from the API: `categoryIcons`,
// `categoryColors`).
const ICON_LABELS: Record<CategoryIconName, string> = {
  utensils: 'Cubiertos',
  'shopping-cart': 'Changuito',
  car: 'Auto',
  'bed-double': 'Cama',
  'party-popper': 'Fiesta',
  'shopping-bag': 'Bolsa',
  zap: 'Rayo',
  shapes: 'Formas',
  fuel: 'Nafta',
  plane: 'Avión',
  bus: 'Colectivo',
  home: 'Casa',
  gift: 'Regalo',
  heart: 'Corazón',
  coffee: 'Café',
  beer: 'Cerveza',
  pizza: 'Pizza',
  shirt: 'Ropa',
  'gamepad-2': 'Juegos',
  music: 'Música',
  film: 'Cine',
  ticket: 'Entrada',
  dumbbell: 'Gimnasio',
  'paw-print': 'Mascota',
  baby: 'Bebé',
  'graduation-cap': 'Estudio',
  stethoscope: 'Salud',
  pill: 'Remedios',
  wifi: 'Internet',
  smartphone: 'Celular',
  book: 'Libro',
  briefcase: 'Trabajo',
  wrench: 'Arreglos',
  'tree-pine': 'Naturaleza',
  sun: 'Sol',
  wallet: 'Billetera',
};

const COLOR_LABELS: Record<CategoryColor, string> = {
  'chart-1': 'Verde',
  'chart-2': 'Naranja',
  'chart-3': 'Terracota',
  'chart-4': 'Azul',
  'chart-5': 'Oliva',
  positive: 'Menta',
  negative: 'Coral',
  highlight: 'Durazno',
  primary: 'Yerba',
  muted: 'Gris',
};

export type CategoryDraft = { name: string; icon: CategoryIconName; color: CategoryColor };

/** Name, icon and color of a category: to create one or to edit it. */
export function CategoryEditor({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: CategoryDraft;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (draft: CategoryDraft) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState<CategoryIconName>(initial?.icon ?? 'shapes');
  const [color, setColor] = useState<CategoryColor>(initial?.color ?? 'chart-1');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit({ name: name.trim(), icon, color });
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} className="size-11" />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nombre de la categoría"
          placeholder="Ej.: Nafta"
          maxLength={30}
          required
          autoFocus
        />
      </div>

      <div>
        <p id="icon-label" className="mb-1.5 text-xs font-medium text-muted-foreground">
          Ícono
        </p>
        <div role="radiogroup" aria-labelledby="icon-label" className="flex flex-wrap gap-1.5">
          {categoryIcons.map((key) => {
            const Icon = CATEGORY_ICONS[key];
            const checked = key === icon;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={ICON_LABELS[key]}
                onClick={() => setIcon(key)}
                className={cn(
                  'press grid size-9 place-items-center rounded-lg border transition-colors',
                  checked
                    ? 'border-primary bg-accent text-accent-foreground ring-2 ring-primary/30'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p id="color-label" className="mb-1.5 text-xs font-medium text-muted-foreground">
          Color
        </p>
        <div role="radiogroup" aria-labelledby="color-label" className="flex flex-wrap gap-2">
          {categoryColors.map((key) => {
            const checked = key === color;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={COLOR_LABELS[key]}
                title={COLOR_LABELS[key]}
                onClick={() => setColor(key)}
                className={cn(
                  'press grid size-9 place-items-center rounded-full border-2',
                  CATEGORY_COLORS[key],
                  checked ? 'border-foreground' : 'border-transparent',
                )}
              >
                <span className="size-3 rounded-full bg-current" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !name.trim()} className="flex-1">
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
