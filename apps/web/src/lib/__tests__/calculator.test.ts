import { afterEach, describe, expect, it } from 'vitest';

import { caretAfterFormat, evaluateExpression, formatExpression } from '@/lib/calculator';

function asBrowser(language: string) {
  Object.defineProperty(window.navigator, 'language', { value: language, configurable: true });
}

describe('evaluateExpression', () => {
  afterEach(() => asBrowser('es-AR'));

  it('does × and ÷ before + and −', () => {
    expect(evaluateExpression('12.000 + 3.500 + 8.000 ÷ 4')).toBe(17500);
    expect(evaluateExpression('100 − 20 × 2')).toBe(60);
    expect(evaluateExpression('10 − 4 − 3')).toBe(3);
    expect(evaluateExpression('100 ÷ 4 ÷ 5')).toBe(5);
  });

  it('takes the keyboard symbols too (- * x /)', () => {
    expect(evaluateExpression('1000+600/4')).toBe(1150);
    expect(evaluateExpression('10*3-5')).toBe(25);
    expect(evaluateExpression('10x3')).toBe(30);
  });

  it('reads numbers the Argentine way ("1.500,50": the "." is thousands)', () => {
    expect(evaluateExpression('1.500,50 + 0,5')).toBe(1501);
    expect(evaluateExpression('1500')).toBe(1500);
  });

  it('follows the browser language', () => {
    asBrowser('en-US');
    expect(evaluateExpression('1,500.50 + 0.5')).toBe(1501);
  });

  it('rounds the result to cents', () => {
    expect(evaluateExpression('10 ÷ 3')).toBe(3.33);
    expect(evaluateExpression('20 ÷ 3')).toBe(6.67);
    expect(evaluateExpression('20,01 ÷ 2')).toBe(10.01); // 10.005 rounds up
    expect(evaluateExpression('0,1 + 0,2')).toBe(0.3);
  });

  it("isn't a result while the calculation is unfinished or impossible", () => {
    expect(evaluateExpression('')).toBeNull();
    expect(evaluateExpression('5 +')).toBeNull();
    expect(evaluateExpression('÷ 2')).toBeNull();
    expect(evaluateExpression('5 + × 2')).toBeNull();
    expect(evaluateExpression('5 ÷ 0')).toBeNull();
    expect(evaluateExpression('5 − 10')).toBeNull(); // amounts aren't negative
  });

  it('ignores letters and keeps two decimals at most', () => {
    expect(evaluateExpression('1a0')).toBe(10);
    expect(evaluateExpression('10,999')).toBe(10.99);
  });
});

describe('formatExpression', () => {
  afterEach(() => asBrowser('es-AR'));

  it('shows thousands and spaced operators', () => {
    expect(formatExpression('12000+3500+8000/4')).toBe('12.000 + 3.500 + 8.000 ÷ 4');
    expect(formatExpression('1500,5*2-1')).toBe('1.500,5 × 2 − 1');
  });

  it('keeps what is still being typed', () => {
    expect(formatExpression('1500,')).toBe('1.500,');
    expect(formatExpression('5+')).toBe('5 +');
    expect(formatExpression('')).toBe('');
  });

  it('follows the browser language', () => {
    asBrowser('en-US');
    expect(formatExpression('1500.5+1000')).toBe('1,500.5 + 1,000');
  });
});

describe('caretAfterFormat', () => {
  it('keeps the caret after the same digits and operators', () => {
    // Typed "1000" + "+" at the end: the caret goes to the end of "1.000 +".
    expect(caretAfterFormat('1000+', 5, '1.000 +')).toBe(7);
    // A "3" typed in "1.2|00": "1.23|00" is shown as "12.3|00".
    expect(caretAfterFormat('1.2300', 4, '12.300')).toBe(4);
    expect(caretAfterFormat('5 + 3', 0, '5 + 3')).toBe(0);
  });
});
