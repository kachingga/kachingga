import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { CalculatorInput } from '@/components/calculator-input';

function Field({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <CalculatorInput aria-label="Monto" value={value} onValueChange={setValue} />
      <output>{value}</output>
      <button type="button">Otro campo</button>
    </>
  );
}

describe('CalculatorInput', () => {
  it('takes a calculation and keeps the result as the value', async () => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByLabelText('Monto');
    await user.type(input, '1000+600/4');
    expect(input).toHaveValue('1.000 + 600 ÷ 4');
    expect(screen.getByRole('status')).toHaveTextContent('1150');
    expect(screen.getByText('= 1.150')).toBeInTheDocument();

    // Leaving the field shows the result.
    await user.click(screen.getByRole('button', { name: 'Otro campo' }));
    expect(input).toHaveValue('1.150');
  });

  it('keeps the last result while the calculation is unfinished', async () => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByLabelText('Monto');
    await user.type(input, '1.500+');
    expect(input).toHaveValue('1.500 +');
    expect(screen.getByRole('status')).toHaveTextContent('1500');

    await user.click(screen.getByRole('button', { name: 'Otro campo' }));
    expect(input).toHaveValue('1.500');
  });

  it('works as a plain number field ("1.500,5" is 1500.5)', async () => {
    const user = userEvent.setup();
    render(<Field />);
    await user.type(screen.getByLabelText('Monto'), '1.500,5');
    expect(screen.getByLabelText('Monto')).toHaveValue('1.500,5');
    expect(screen.getByRole('status')).toHaveTextContent('1500.5');
    expect(screen.queryByText(/^=/)).not.toBeInTheDocument();
  });

  it('shows a stored value formatted, and the operators only while focused', async () => {
    const user = userEvent.setup();
    render(<Field initial="31100" />);
    expect(screen.getByLabelText('Monto')).toHaveValue('31.100');
    expect(screen.queryByRole('button', { name: 'Sumar' })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Monto'));
    expect(screen.getByRole('button', { name: 'Sumar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Otro campo' }));
    expect(screen.queryByRole('button', { name: 'Sumar' })).not.toBeInTheDocument();
  });

  it('adds operators with the buttons (the phone keyboard has none), keeping the focus', async () => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByLabelText('Monto');
    await user.type(input, '200');
    await user.click(screen.getByRole('button', { name: 'Sumar' }));
    // Another operator right after one replaces it.
    await user.click(screen.getByRole('button', { name: 'Multiplicar' }));
    expect(input).toHaveFocus();
    await user.type(input, '3');
    expect(input).toHaveValue('200 × 3');
    expect(screen.getByRole('status')).toHaveTextContent('600');
  });

  it('empties the value when the field is cleared', async () => {
    const user = userEvent.setup();
    render(<Field initial="500" />);
    await user.clear(screen.getByLabelText('Monto'));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
