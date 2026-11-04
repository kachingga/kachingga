import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { NumberInput } from '@/components/number-input';

function Field({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberInput aria-label="Monto" value={value} onValueChange={setValue} />
      <output>{value}</output>
    </>
  );
}

function asBrowser(language: string) {
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });
}

describe('NumberInput', () => {
  afterEach(() => asBrowser('es-AR'));

  it('shows the Argentine format while keeping the normalized value', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.type(screen.getByLabelText('Monto'), '1500,5');
    expect(screen.getByLabelText('Monto')).toHaveValue('1.500,5');
    expect(screen.getByRole('status')).toHaveTextContent('1500.5');
  });

  it('ignores a "." typed as thousands out of habit ("1.500" is 1500)', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.type(screen.getByLabelText('Monto'), '1.500,25');
    expect(screen.getByLabelText('Monto')).toHaveValue('1.500,25');
    expect(screen.getByRole('status')).toHaveTextContent('1500.25');
  });

  it('allows two decimals at most', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.type(screen.getByLabelText('Monto'), '10,999');
    expect(screen.getByRole('status')).toHaveTextContent('10.99');
  });

  it('shows a stored value formatted', () => {
    render(<Field initial="31100" />);
    expect(screen.getByLabelText('Monto')).toHaveValue('31.100');
  });

  it('follows the browser language', async () => {
    asBrowser('en-US');
    const user = userEvent.setup();
    render(<Field />);
    await user.type(screen.getByLabelText('Monto'), '1500.5');
    expect(screen.getByLabelText('Monto')).toHaveValue('1,500.5');
    expect(screen.getByRole('status')).toHaveTextContent('1500.5');
  });
});
