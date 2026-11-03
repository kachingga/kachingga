import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { GroupList } from '@/routes/groups/list';

const fixGroups = [
  {
    id: 'g1',
    name: 'Viaje a Floripa',
    baseCurrency: 'ARS',
    archivedAt: null,
    _count: { participants: 3 },
  },
  {
    id: 'g2',
    name: 'Depto Palermo',
    baseCurrency: 'ARS',
    archivedAt: null,
    _count: { participants: 2 },
  },
];

describe('GroupList', () => {
  it('shows loading skeletons', () => {
    renderWithApi(<GroupList />, { 'groups.list': neverResolves });
    expect(screen.getByRole('heading', { name: 'Grupos' })).toBeInTheDocument();
  });

  it('shows groups when loaded', async () => {
    renderWithApi(<GroupList />, { 'groups.list': () => fixGroups });
    expect(await screen.findByText('Viaje a Floripa')).toBeInTheDocument();
    expect(screen.getByText('Depto Palermo')).toBeInTheDocument();
  });

  it('shows empty state when there are no groups', async () => {
    renderWithApi(<GroupList />, { 'groups.list': () => [] });
    expect(await screen.findByText('Todavía no tenés grupos')).toBeInTheDocument();
  });

  it('shows error state', async () => {
    renderWithApi(<GroupList />, {
      'groups.list': () => {
        throw apiError('Error de red');
      },
    });
    expect(await screen.findByText('Error de red')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('shows bottom nav', () => {
    renderWithApi(<GroupList />, { 'groups.list': neverResolves });
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });
});
