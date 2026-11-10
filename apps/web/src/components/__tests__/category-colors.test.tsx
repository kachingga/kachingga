import { categoryColors, defaultCategories } from '@kachingga/api/schemas';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CategoryEditor } from '@/components/category-editor';
import { CategoryPicker } from '@/components/category-picker';
import { CategoryIcon } from '@/components/kit';
import { CATEGORY_COLORS, CATEGORY_COLORS_STRONG } from '@/lib/categories';

describe('category colors', () => {
  it('every color is a theme token pair (soft background + strong icon), never a fixed color', () => {
    for (const color of categoryColors) {
      expect(CATEGORY_COLORS[color]).toBe(`bg-cat-${color}-soft text-cat-${color}`);
    }
  });

  it('a picked category fills with its own color (the same tokens, swapped)', () => {
    for (const color of categoryColors) {
      expect(CATEGORY_COLORS_STRONG[color]).toBe(
        `bg-cat-${color} text-cat-${color}-soft ring-cat-${color}`,
      );
    }
  });

  it('the picker shows each category in its color and fills the picked one', () => {
    render(
      <CategoryPicker
        categories={[
          { id: 'c1', name: 'Comida', icon: 'utensils', color: 'tangerine' },
          { id: 'c2', name: 'Súper', icon: 'shopping-cart', color: 'lime' },
        ]}
        value="c2"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Comida' })).toHaveClass(
      'bg-cat-tangerine-soft',
      'text-cat-tangerine',
    );
    const picked = screen.getByRole('radio', { name: 'Súper' });
    expect(picked).toHaveAttribute('aria-checked', 'true');
    expect(picked).toHaveClass('bg-cat-lime', 'text-cat-lime-soft', 'ring-2');
  });

  it('the built-in categories have 8 different colors', () => {
    expect(new Set(defaultCategories.map((c) => c.color)).size).toBe(8);
  });

  it('CategoryIcon paints the icon in its color on its soft background', () => {
    const { container } = render(<CategoryIcon icon="utensils" color="tangerine" />);
    expect(container.firstElementChild).toHaveClass('bg-cat-tangerine-soft', 'text-cat-tangerine');
  });

  it('unknown colors (old data) fall back to cocoa', () => {
    const { container } = render(<CategoryIcon icon="nope" color="chart-1" />);
    expect(container.firstElementChild).toHaveClass('bg-cat-cocoa-soft', 'text-cat-cocoa');
  });

  it('the editor offers all 12 colors with their names', () => {
    render(<CategoryEditor submitLabel="Crear" onSubmit={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Color' });
    const options = Array.from(group.querySelectorAll('[role="radio"]')).map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(options).toEqual([
      'Tomate',
      'Mandarina',
      'Mango',
      'Lima',
      'Menta',
      'Turquesa',
      'Cielo',
      'Índigo',
      'Uva',
      'Frambuesa',
      'Rosa',
      'Cacao',
    ]);
  });
});
