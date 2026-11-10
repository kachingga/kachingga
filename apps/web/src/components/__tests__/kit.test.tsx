import { categoryColors } from '@kachingga/api/schemas';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Users } from 'lucide-react';

import { Avatar, AvatarStack, EmptyState, Money } from '@/components/kit';
import { CATEGORY_COLORS, colorForId } from '@/lib/categories';

describe('kit', () => {
  it('a person always gets the same color (one of the 12, as theme tokens), from their id', () => {
    const color = colorForId('cm3participant01');
    expect(categoryColors).toContain(color);
    expect(colorForId('cm3participant01')).toBe(color);

    const { container } = render(<Avatar id="cm3participant01" name="tuke" />);
    expect(container.firstElementChild).toHaveTextContent('T');
    expect(container.firstElementChild).toHaveClass(...CATEGORY_COLORS[color].split(' '));
  });

  it('different people get different colors (most of the time)', () => {
    const ids = Array.from({ length: 24 }, (_, i) => `participant-${i}`);
    expect(new Set(ids.map(colorForId)).size).toBeGreaterThan(6);
  });

  it('the faces of a group: up to 5 and "+N" for the rest', () => {
    const people = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fede'].map((name, i) => ({
      id: `p${i}`,
      name,
    }));
    const { container } = render(<AvatarStack people={people} />);
    expect(container).toHaveTextContent('ABCDE+1');

    const { container: few } = render(<AvatarStack people={people.slice(0, 2)} />);
    expect(few).toHaveTextContent(/^AB$/);
  });

  it('Money shows the cents smaller', () => {
    const { container } = render(<Money cents={1250050} currency="ARS" />);
    expect(container).toHaveTextContent(/^\$\s12\.500,50$/);
    expect(screen.getByText(',50')).toHaveClass('text-[0.55em]');
  });

  it('EmptyState: what goes there and the action to start', () => {
    render(
      <EmptyState icon={Users} title="Todavía no tenés grupos" description="Creá uno.">
        <button type="button">Crear grupo</button>
      </EmptyState>,
    );
    expect(screen.getByText('Todavía no tenés grupos')).toBeInTheDocument();
    expect(screen.getByText('Creá uno.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear grupo' })).toBeInTheDocument();
  });
});
