import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { neverResolves, renderWithApi } from '@/test/render';
import { Participants } from '@/routes/groups/participants';

const fixGroup = {
  id: 'g1',
  name: 'Viaje',
  baseCurrency: 'ARS',
  inviteCode: 'ABC12345',
  archivedAt: null,
  createdById: 'u1',
  myParticipantId: 'p1',
  participants: [
    {
      id: 'p1',
      name: 'Juan',
      hasAccount: true,
      isMe: true,
      paymentAlias: 'juan.alias',
      paymentAliasSource: 'account' as const,
    },
    {
      id: 'p2',
      name: 'Tuke',
      hasAccount: true,
      isMe: false,
      paymentAlias: null,
      paymentAliasSource: null,
    },
    {
      id: 'p3',
      name: 'Sofi',
      hasAccount: false,
      isMe: false,
      paymentAlias: null,
      paymentAliasSource: null,
    },
  ],
};

describe('Participants', () => {
  it('shows loading state', () => {
    renderWithApi(<Participants />, { 'groups.get': neverResolves });
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('shows participants list', async () => {
    renderWithApi(<Participants />, { 'groups.get': () => fixGroup });
    expect(await screen.findByText('Juan')).toBeInTheDocument();
    expect(screen.getByText('Tuke')).toBeInTheDocument();
    expect(screen.getByText('Sofi')).toBeInTheDocument();
  });

  it('shows "sin cuenta" badge for participants without account', async () => {
    renderWithApi(<Participants />, { 'groups.get': () => fixGroup });
    await screen.findByText('Juan');
    expect(screen.getByText('sin cuenta')).toBeInTheDocument();
  });

  it('shows add participant form', async () => {
    renderWithApi(<Participants />, { 'groups.get': () => fixGroup });
    await screen.findByText('Juan');
    expect(screen.getByPlaceholderText('Nombre (sin cuenta)')).toBeInTheDocument();
  });
});
