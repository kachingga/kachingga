import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AnimatedLayout } from '@/components/animated-layout';
import { useGoBack } from '@/lib/use-go-back';

function Form() {
  const goBack = useGoBack();
  return <button onClick={() => goBack('/grupo')}>Guardar</button>;
}

function setup(initialEntries: string[]) {
  const router = createMemoryRouter(
    [
      {
        element: <AnimatedLayout />,
        children: [
          { path: '/grupo', element: <p>Grupo</p> },
          { path: '/grupo/nuevo', element: <Form /> },
        ],
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const page = (text: string) => screen.getByText(text).parentElement!;

describe('screen transitions', () => {
  it('slides in from the right going forward and from the left going back', async () => {
    const router = setup(['/grupo']);
    await act(() => router.navigate('/grupo/nuevo'));
    expect(screen.getByRole('button', { name: 'Guardar' }).parentElement).toHaveClass(
      'page-enter-right',
    );
    await act(() => router.navigate(-1));
    expect(page('Grupo')).toHaveClass('page-enter-left');
  });

  it('closing a form opened from the app goes back (no duplicate in the history)', async () => {
    const router = setup(['/grupo', '/grupo/nuevo']);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(page('Grupo')).toHaveClass('page-enter-left');
    expect(router.state.historyAction).toBe('POP');
  });

  it('closing a form opened from a link goes to the fallback, animating as going back', async () => {
    const router = setup(['/grupo/nuevo']);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(page('Grupo')).toHaveClass('page-enter-left');
    expect(router.state.location.pathname).toBe('/grupo');
  });
});
