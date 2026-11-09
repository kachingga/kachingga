import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { apiError, renderWithApi } from '@/test/render';
import { JoinGroup } from '@/routes/groups/join';

const preview = {
  id: 'g1',
  name: 'Viaje',
  baseCurrency: 'ARS',
  alreadyMember: false,
  unclaimedParticipants: [{ id: 'p-juan', name: 'Juan' }],
};

describe('JoinGroup', () => {
  it('shows code input form', () => {
    renderWithApi(<JoinGroup />);
    expect(screen.getByLabelText('Código de invitación')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar grupo' })).toBeInTheDocument();
  });

  it('looks up the code from an invite link', async () => {
    let asked: unknown;
    renderWithApi(
      <JoinGroup />,
      {
        'groups.preview': (input) => {
          asked = input;
          return preview;
        },
      },
      '/grupos/unirme?codigo=ab3x7k2m',
    );
    expect(await screen.findByText('Viaje')).toBeInTheDocument();
    expect(asked).toEqual({ inviteCode: 'AB3X7K2M' });
    expect(screen.getByText('Soy Juan')).toBeInTheDocument();
  });

  it('offers to go to the group when already a member', async () => {
    renderWithApi(
      <JoinGroup />,
      { 'groups.preview': () => ({ ...preview, alreadyMember: true }) },
      '/grupos/unirme?codigo=AB3X7K2M',
    );
    expect(await screen.findByText('Ya sos parte de este grupo.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al grupo' })).toHaveAttribute('href', '/grupos/g1');
    expect(screen.queryByRole('button', { name: 'Unirme' })).not.toBeInTheDocument();
  });

  it('shows the error for an invalid code', async () => {
    const user = userEvent.setup();
    renderWithApi(<JoinGroup />, {
      'groups.preview': () => {
        throw apiError('Código inválido', 'NOT_FOUND');
      },
    });
    await user.type(screen.getByLabelText('Código de invitación'), 'NOEXISTE');
    await user.click(screen.getByRole('button', { name: 'Buscar grupo' }));
    expect(await screen.findByText('Código inválido')).toBeInTheDocument();
  });
});
