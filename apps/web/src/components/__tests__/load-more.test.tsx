import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoadMore } from '@/components/load-more';

let observed: ((entries: { isIntersecting: boolean }[]) => void) | null = null;

class FakeIntersectionObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    observed = callback;
  }
  observe() {}
  disconnect() {
    observed = null;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  observed = null;
});

describe('LoadMore', () => {
  it('loads the next page when the end of the list comes into view', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const onLoadMore = vi.fn();
    render(<LoadMore hasMore loading={false} onLoadMore={onLoadMore} />);
    observed!([{ isIntersecting: false }]);
    expect(onLoadMore).not.toHaveBeenCalled();
    observed!([{ isIntersecting: true }]);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows a skeleton while loading and does not ask again', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    render(<LoadMore hasMore loading onLoadMore={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Cargando más gastos' })).toBeInTheDocument();
    expect(observed).toBeNull();
  });

  it('renders nothing when there are no more pages', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const { container } = render(<LoadMore hasMore={false} loading={false} onLoadMore={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('falls back to a button without IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onLoadMore = vi.fn();
    render(<LoadMore hasMore loading={false} onLoadMore={onLoadMore} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
