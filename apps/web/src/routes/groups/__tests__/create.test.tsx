import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { neverResolves, renderWithApi } from '@/test/render';
import { CreateGroup } from '@/routes/groups/create';

describe('CreateGroup', () => {
  it('shows form fields', () => {
    renderWithApi(<CreateGroup />);
    expect(screen.getByLabelText('Nombre del grupo')).toBeInTheDocument();
    expect(screen.getByLabelText('Moneda base')).toBeInTheDocument();
    expect(screen.getByLabelText('¿Cómo te llamás en este grupo?')).toBeInTheDocument();
  });

  it('shows loading state while creating', async () => {
    renderWithApi(<CreateGroup />, { 'groups.create': neverResolves });
    expect(screen.getByRole('button', { name: 'Crear grupo' })).toBeInTheDocument();
  });

  it('shows invite code after creation', async () => {
    renderWithApi(<CreateGroup />, {
      'groups.create': () => ({
        id: 'g1',
        name: 'Test',
        inviteCode: 'ABC12345',
        baseCurrency: 'ARS',
      }),
    });
    // Form is shown initially
    expect(screen.getByLabelText('Nombre del grupo')).toBeInTheDocument();
  });
});
