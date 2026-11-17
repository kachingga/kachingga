import { getLocale, numberSeparators } from '@/lib/format';

// Calculations typed in an amount field ("12.000 + 3.500 + 8.000 ÷ 4", #167): numbers in the
// browser's language and + − × ÷, with × and ÷ before + and − (no parentheses). Used by
// <CalculatorInput>; the result goes to the form as a normalized numeric string, like <NumberInput>.

export type Operator = '+' | '−' | '×' | '÷';

/** What each key that can be typed means (the keyboard has "-", "*" and "/", or an "x"). */
const operatorKeys: Record<string, Operator> = {
  '+': '+',
  '-': '−',
  '−': '−',
  '*': '×',
  x: '×',
  X: '×',
  '×': '×',
  '/': '÷',
  '÷': '÷',
};

export function isOperatorKey(char: string | undefined): boolean {
  return char !== undefined && char in operatorKeys;
}

/** Above this the cents stop being exact: the result doesn't count. */
const MAX_RESULT = Number.MAX_SAFE_INTEGER / 100;

type Token = { number: string } | { operator: Operator };

/**
 * What was typed, as numbers and operators. Thousands separators and spaces are dropped (in es-AR
 * a "." is never a decimal, like in <NumberInput>), anything else that isn't a digit, the
 * language's decimal separator or an operator is ignored, and each number keeps at most `decimals`.
 */
function tokenize(text: string, decimals: number): Token[] {
  const { decimal } = numberSeparators();
  const tokens: Token[] = [];
  for (const char of text) {
    const last = tokens.at(-1);
    if (/\d/.test(char) || char === decimal) {
      const digit = char === decimal ? '.' : char;
      if (last && 'number' in last) {
        const [, fraction] = last.number.split('.');
        if (digit === '.' && fraction !== undefined) continue;
        if (fraction !== undefined && fraction.length >= decimals) continue;
        if (digit === '.' && decimals === 0) continue;
        last.number += digit;
      } else if (digit !== '.' || decimals > 0) {
        tokens.push({ number: digit });
      }
    } else if (isOperatorKey(char)) {
      tokens.push({ operator: operatorKeys[char]! });
    }
    // Anything else (thousands separators, spaces, letters) is dropped.
  }
  return tokens;
}

/** A number as typed ("1500.5") in the browser's language, with thousands ("1.500,5"). */
function formatTypedNumber(number: string): string {
  const { decimal } = numberSeparators();
  const [whole = '', fraction] = number.split('.');
  const grouped = whole === '' ? '' : new Intl.NumberFormat(getLocale()).format(BigInt(whole));
  return fraction === undefined ? grouped : `${grouped}${decimal}${fraction}`;
}

/**
 * What the field shows for what was typed: numbers with thousands and operators spaced
 * ("1000+600/4" → "1.000 + 600 ÷ 4" in es-AR). Doesn't fix the calculation: "5 + × 2" stays.
 */
export function formatExpression(text: string, decimals = 2): string {
  return tokenize(text, decimals)
    .map((t) => ('number' in t ? formatTypedNumber(t.number) : t.operator))
    .join(' ');
}

/**
 * The result of what was typed ("1.000 + 600 ÷ 4" → 1150), rounded to `decimals`, or null if it
 * isn't a complete calculation ("5 +", "÷ 2"), divides by zero or gives a negative number.
 */
export function evaluateExpression(text: string, decimals = 2): number | null {
  const tokens = tokenize(text, decimals);
  if (tokens.length === 0) return null;

  // number (operator number)*, alternating
  const numbers: number[] = [];
  const operators: Operator[] = [];
  for (const [i, token] of tokens.entries()) {
    const wantsNumber = i % 2 === 0;
    if (wantsNumber !== 'number' in token) return null;
    if ('number' in token) numbers.push(Number(token.number === '.' ? 0 : token.number));
    else operators.push(token.operator);
  }
  if (numbers.length === operators.length) return null; // ends with an operator

  // × and ÷ first: fold them into the terms, then add and subtract the terms.
  const terms = [numbers[0]!];
  const signs: Operator[] = [];
  for (const [i, operator] of operators.entries()) {
    const next = numbers[i + 1]!;
    if (operator === '×') terms.push(terms.pop()! * next);
    else if (operator === '÷') {
      if (next === 0) return null;
      terms.push(terms.pop()! / next);
    } else {
      signs.push(operator);
      terms.push(next);
    }
  }
  const result = terms.reduce((sum, term, i) =>
    i === 0 ? term : signs[i - 1] === '+' ? sum + term : sum - term,
  );

  if (!Number.isFinite(result) || result > MAX_RESULT) return null;
  const rounded = roundTo(result, decimals);
  return rounded < 0 ? null : rounded;
}

/** Rounds half up on the decimal digits as written (10.005 → 10.01, not 10.00 like toFixed). */
function roundTo(value: number, decimals: number): number {
  const rounded = Number(`${Math.round(Number(`${value}e${decimals}`))}e-${decimals}`);
  return Number.isFinite(rounded) ? rounded : Number(value.toFixed(decimals));
}

/** Whether what was typed is a calculation (has an operator), not just a number. */
export function hasOperator(text: string): boolean {
  return [...text].some(isOperatorKey);
}

/**
 * Where the caret goes in the formatted text: after the same number of digits, decimal
 * separators and operators it had before it in what was typed (thousands and spaces don't count).
 */
export function caretAfterFormat(typed: string, caret: number, formatted: string): number {
  const { decimal } = numberSeparators();
  const counts = (char: string) => /\d/.test(char) || char === decimal || isOperatorKey(char);
  let wanted = [...typed.slice(0, caret)].filter(counts).length;
  if (wanted === 0) return 0;
  for (const [i, char] of [...formatted].entries()) {
    if (counts(char) && --wanted === 0) return i + 1;
  }
  return formatted.length;
}
