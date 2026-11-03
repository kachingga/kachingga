import { formatMoney, parseMoneyInput } from '../format';

describe('formatMoney', () => {
  it('formats ARS cents the Argentine way', () => {
    expect(formatMoney(1555000, 'ARS').replace(/\s/g, ' ')).toBe('$ 15.550,00');
  });

  it('keeps the currency of the data', () => {
    expect(formatMoney(2000, 'USD')).toContain('20,00');
    expect(formatMoney(2000, 'USD')).toMatch(/US\$|USD/);
  });
});

describe('parseMoneyInput', () => {
  it.each([
    ['20', 2000],
    ['20,5', 2050],
    ['1.234,56', 123456],
    ['1234.56', 123456],
    ['15.550', 1555000],
  ])('%s → %d cents', (input, cents) => {
    expect(parseMoneyInput(input)).toBe(cents);
  });

  it.each(['', 'abc', '-5', '1,2,3x'])('rejects %p', (input) => {
    expect(parseMoneyInput(input)).toBeNull();
  });
});
