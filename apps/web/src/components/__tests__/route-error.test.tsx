import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { RouteError } from '@/components/route-error';

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock('@/lib/monitoring', () => ({ reportError }));

function Broken(): never {
  throw new TypeError('boom');
}

describe('RouteError', () => {
  it('reports the crash and offers to retry instead of a blank page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const router = createMemoryRouter([
      { path: '/', element: <Broken />, errorElement: <RouteError /> },
    ]);
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Algo salió mal en esta pantalla.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }));
  });
});
