import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { apiError, neverResolves, renderWithApi } from '@/test/render';
import { Categories } from '@/routes/groups/categories';

const fixGroup = {
  id: 'g1',
  name: 'Viaje',
  baseCurrency: 'ARS',
  inviteCode: 'ABC12345',
  archivedAt: null as Date | null,
  createdById: 'u1',
  myParticipantId: 'p1',
  participants: [],
};

const category = (
  id: string,
  name: string,
  extra: Partial<{ archived: boolean; expenseCount: number; defaultKey: string | null }> = {},
) => ({
  id,
  name,
  icon: 'shapes',
  color: 'muted',
  defaultKey: null,
  archived: false,
  expenseCount: 0,
  ...extra,
});

const fixCategories = [
  category('c-food', 'Comida', { defaultKey: 'FOOD', expenseCount: 3 }),
  category('c-other', 'Otros', { defaultKey: 'OTHER' }),
  category('c-old', 'Vieja', { archived: true, expenseCount: 1 }),
];

const api = (extra: Record<string, (input: unknown) => unknown> = {}) => ({
  'groups.get': () => fixGroup,
  'categories.list': () => fixCategories,
  ...extra,
});

describe('Categories', () => {
  it('shows a skeleton while loading', () => {
    renderWithApi(<Categories />, {
      'groups.get': neverResolves,
      'categories.list': neverResolves,
    });
    expect(screen.getByRole('status', { name: 'Cargando' })).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    renderWithApi(<Categories />, {
      'groups.get': () => fixGroup,
      'categories.list': () => {
        throw apiError('Se cayó');
      },
    });
    expect(await screen.findByText('Se cayó')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('lists active categories with their expense count, and archived ones apart', async () => {
    renderWithApi(<Categories />, api());
    expect(await screen.findByText('Comida')).toBeInTheDocument();
    expect(screen.getByText('3 gastos')).toBeInTheDocument();
    expect(screen.getByText('Sin gastos')).toBeInTheDocument();
    const archived = screen.getByRole('heading', { name: 'Archivadas' }).parentElement!;
    expect(within(archived).getByText('Vieja')).toBeInTheDocument();
    expect(within(archived).getByRole('button', { name: 'Desarchivar' })).toBeInTheDocument();
  });

  it('creates a category with a name, icon and color', async () => {
    const user = userEvent.setup();
    const created: unknown[] = [];
    renderWithApi(
      <Categories />,
      api({
        'categories.create': (input) => {
          created.push(input);
          return { id: 'c-new' };
        },
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Nueva categoría' }));
    await user.type(screen.getByLabelText('Nombre de la categoría'), 'Nafta');
    await user.click(screen.getByRole('radio', { name: 'Nafta' }));
    await user.click(screen.getByRole('radio', { name: 'Azul' }));
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    await waitFor(() =>
      expect(created).toEqual([
        { groupId: undefined, name: 'Nafta', icon: 'fuel', color: 'chart-4' },
      ]),
    );
  });

  it('edits a category and shows the API error if the name is taken', async () => {
    const user = userEvent.setup();
    renderWithApi(
      <Categories />,
      api({
        'categories.update': () => {
          throw apiError('Ya hay una categoría con ese nombre', 'CONFLICT');
        },
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Editar Comida' }));
    const name = screen.getByLabelText('Nombre de la categoría');
    expect(name).toHaveValue('Comida');
    await user.clear(name);
    await user.type(name, 'Otros');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ya hay una categoría con ese nombre')).toBeInTheDocument();
  });

  it('archives a category after confirming, telling how many expenses keep it', async () => {
    const user = userEvent.setup();
    const archived: unknown[] = [];
    renderWithApi(
      <Categories />,
      api({
        'categories.archive': (input) => {
          archived.push(input);
          return { id: 'c-food' };
        },
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Editar Comida' }));
    await user.click(screen.getByRole('button', { name: 'Archivar categoría' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('¿Archivar "Comida"?');
    expect(dialog).toHaveTextContent('Sus 3 gastos la conservan');
    await user.click(within(dialog).getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(archived).toEqual([{ categoryId: 'c-food' }]));
  });

  it('unarchives a category', async () => {
    const user = userEvent.setup();
    const restored: unknown[] = [];
    renderWithApi(
      <Categories />,
      api({
        'categories.unarchive': (input) => {
          restored.push(input);
          return { id: 'c-old' };
        },
      }),
    );
    await user.click(await screen.findByRole('button', { name: 'Desarchivar' }));
    await waitFor(() => expect(restored).toEqual([{ categoryId: 'c-old' }]));
  });

  it('an archived group shows the notice and no edit actions', async () => {
    renderWithApi(<Categories />, {
      ...api(),
      'groups.get': () => ({ ...fixGroup, archivedAt: new Date() }),
    });
    expect(await screen.findByText('Comida')).toBeInTheDocument();
    expect(screen.getByText(/archivado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva categoría' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Comida' })).not.toBeInTheDocument();
    // The notice's "Desarchivar" is the group's; archived categories have none.
    const archived = screen.getByRole('heading', { name: 'Archivadas' }).parentElement!;
    expect(within(archived).queryByRole('button', { name: 'Desarchivar' })).not.toBeInTheDocument();
  });
});
