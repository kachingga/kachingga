import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithApi } from '@/test/render';
import { JoinGroup } from '@/routes/groups/join';

describe('JoinGroup', () => {
  it('shows code input form', () => {
    renderWithApi(<JoinGroup />);
    expect(screen.getByLabelText('Código de invitación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar grupo' })).toBeInTheDocument();
  });
});
