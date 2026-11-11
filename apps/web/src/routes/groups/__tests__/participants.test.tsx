import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { Participants } from '@/routes/groups/participants';

const fixGroup = {
  id: 'g1',
  name: 'Viaje',
  baseCurrency: 'ARS',
  inviteCode: 'ABC12345',
  archivedAt: null,
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

  it('shows the alias of each one, and only mine can be changed', async () => {
    renderWithApi(<Participants />, { 'groups.get': () => fixGroup });
    await screen.findByText('Juan');
    expect(screen.getByText(/Alias: juan\.alias/)).toHaveTextContent(
      'Alias: juan.alias (de la cuenta)',
    );
    // Tuke (with account) and Sofi (without account): no alias, and nobody else can set one.
    expect(screen.getAllByText('Sin alias')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cambiar' })).toHaveLength(1);
  });

  it('changes my alias for this group', async () => {
    const user = userEvent.setup();
    const saved: unknown[] = [];
    renderWithApi(<Participants />, {
      'groups.get': () => fixGroup,
      'participants.setPaymentAlias': (input) => {
        saved.push(input);
        return { ok: true };
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Cambiar' }));
    const input = screen.getByLabelText('Alias de Juan');
    await user.clear(input);
    await user.type(input, 'juan.viajes');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() =>
      expect(saved).toEqual([{ participantId: 'p1', paymentAlias: 'juan.viajes' }]),
    );
  });

  it('shows add participant form', async () => {
    renderWithApi(<Participants />, { 'groups.get': () => fixGroup });
    await screen.findByText('Juan');
    expect(screen.getByPlaceholderText('Nombre (sin cuenta)')).toBeInTheDocument();
  });

  it('removes a participant without account after confirming', async () => {
    const user = userEvent.setup();
    const removed: unknown[] = [];
    renderWithApi(<Participants />, {
      'groups.get': () => fixGroup,
      'participants.remove': (input) => {
        removed.push(input);
        return { ok: true };
      },
    });
    await screen.findByText('Sofi');
    // Only people without account can be removed.
    expect(screen.getAllByRole('button', { name: 'Quitar' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Quitar' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('¿Quitar a Sofi?');
    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(removed).toEqual([{ participantId: 'p3' }]));
  });

  it('explains why a participant cannot be removed', async () => {
    const user = userEvent.setup();
    renderWithApi(<Participants />, {
      'groups.get': () => fixGroup,
      'participants.remove': () => {
        throw apiError('No se puede quitar: aparece en gastos o pagos');
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Quitar' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Quitar' }),
    );
    expect(
      await screen.findByText('No se puede quitar: aparece en gastos o pagos'),
    ).toBeInTheDocument();
  });

  it('renames a participant', async () => {
    const user = userEvent.setup();
    const renamed: unknown[] = [];
    renderWithApi(<Participants />, {
      'groups.get': () => fixGroup,
      'participants.rename': (input) => {
        renamed.push(input);
        return { ok: true };
      },
    });
    await screen.findByText('Sofi');
    await user.click(screen.getAllByRole('button', { name: 'Renombrar' })[2]!);
    const input = screen.getByDisplayValue('Sofi');
    await user.clear(input);
    await user.type(input, 'Sofía');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(renamed).toEqual([{ participantId: 'p3', name: 'Sofía' }]));
  });

  it('an archived group shows the notice and no edit actions', async () => {
    renderWithApi(<Participants />, {
      'groups.get': () => ({ ...fixGroup, archivedAt: new Date('2026-11-01') }),
    });
    expect(await screen.findByText('Grupo archivado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renombrar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambiar' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Nombre (sin cuenta)')).not.toBeInTheDocument();
  });
});
