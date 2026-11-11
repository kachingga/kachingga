import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { NotFound } from '@/components/not-found';
import { RouteError } from '@/components/route-error';

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock('@/lib/monitoring', () => ({ reportError }));

describe('NotFound', () => {
  it('says the page does not exist, links to the groups and reports nothing', async () => {
    const router = createMemoryRouter(
      [
        {
          errorElement: <RouteError />,
          children: [
            { path: '/grupos', element: <p>Mis grupos</p> },
            { path: '*', element: <NotFound /> },
          ],
        },
      ],
      { initialEntries: ['/terms-of-service'] },
    );
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Esta página no existe')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a mis grupos' })).toHaveAttribute(
      'href',
      '/grupos',
    );
    expect(reportError).not.toHaveBeenCalled();
  });
});
