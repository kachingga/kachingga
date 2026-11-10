import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { createMemoryRouter, RouterProvider, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AnimatedLayout } from '@/components/animated-layout';
import { useGoBack } from '@/lib/use-go-back';

// jsdom has no View Transitions: these cover the CSS fallback (the API side is in
// src/lib/__tests__/screen-transitions.test.ts and e2e/transiciones.spec.ts).

function Form() {
  const goBack = useGoBack();
  return <button onClick={() => goBack('/grupo')}>Guardar</button>;
}

/** A screen that shows its title once its data arrives (a skeleton before). */
function Loading() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 10);
    return () => clearTimeout(timer);
  }, []);
  return loaded ? <h1>Viaje</h1> : <p>Cargando…</p>;
}

/** Like the filters: state of its own + a search param typed into the URL. */
function Filters() {
  const [, setSearchParams] = useSearchParams();
  const [text, setText] = useState('');
  return (
    <input
      aria-label="Descripción"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        setSearchParams({ q: e.target.value }, { replace: true });
      }}
    />
  );
}

function setup(initialEntries: string[]) {
  const router = createMemoryRouter(
    [
      {
        element: <AnimatedLayout />,
        children: [
          { path: '/grupo', element: <p>Grupo</p> },
          { path: '/grupo/nuevo', element: <Form /> },
          { path: '/filtros', element: <Filters /> },
          { path: '/gasto', element: <h1>Un gasto</h1> },
          { path: '/editar', element: <input aria-label="Monto" autoFocus /> },
          { path: '/viaje', element: <Loading /> },
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
  it('a new screen takes the focus to its title (screen readers announce it)', async () => {
    const router = setup(['/gasto']);
    // Opening the app: the focus isn't moved.
    expect(screen.getByRole('heading', { name: 'Un gasto' })).not.toHaveFocus();
    await act(() => router.navigate('/grupo'));
    await act(() => router.navigate(-1));
    expect(screen.getByRole('heading', { name: 'Un gasto' })).toHaveFocus();
  });

  it('a screen still loading gets the focus on its title as soon as it shows up', async () => {
    const router = setup(['/grupo']);
    await act(() => router.navigate('/viaje'));
    expect(await screen.findByRole('heading', { name: 'Viaje' })).toHaveFocus();
  });

  it('unless the screen already focused a field (autoFocus)', async () => {
    const router = setup(['/grupo']);
    await act(() => router.navigate('/editar'));
    expect(screen.getByRole('textbox', { name: 'Monto' })).toHaveFocus();
  });

  it('the first screen when opening the app does not animate', () => {
    setup(['/grupo']);
    expect(page('Grupo')).not.toHaveClass('page-enter-right');
    expect(page('Grupo')).not.toHaveClass('page-enter-left');
    expect(document.documentElement.dataset.nav).toBe('none');
  });

  it('changing only the search params stays on the same screen (typing keeps going)', async () => {
    const user = userEvent.setup();
    const router = setup(['/grupo', '/filtros']);
    const input = screen.getByRole('textbox', { name: 'Descripción' });
    await user.type(input, 'cena');
    // Same element, still focused, with everything typed: the screen wasn't remounted.
    expect(screen.getByRole('textbox', { name: 'Descripción' })).toBe(input);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('cena');
    expect(router.state.location.search).toBe('?q=cena');
  });

  it('slides in from the right going forward and from the left going back', async () => {
    const router = setup(['/grupo']);
    await act(() => router.navigate('/grupo/nuevo'));
    expect(screen.getByRole('button', { name: 'Guardar' }).parentElement).toHaveClass(
      'page-enter-right',
    );
    expect(document.documentElement.dataset.nav).toBe('forward');
    await act(() => router.navigate(-1));
    expect(page('Grupo')).toHaveClass('page-enter-left');
    expect(document.documentElement.dataset.nav).toBe('back');
  });

  it('a link up to the screen that contains this one ("Mis grupos") animates as going back', async () => {
    const router = setup(['/grupo/nuevo']);
    await act(() => router.navigate('/grupo'));
    expect(router.state.historyAction).toBe('PUSH');
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
