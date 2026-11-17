import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  caretAfterFormat,
  evaluateExpression,
  formatExpression,
  hasOperator,
  isOperatorKey,
  type Operator,
} from '@/lib/calculator';
import { formatNumber, toNumber } from '@/lib/format';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'size'
> & {
  /** Normalized numeric string ("1500.5"), "" when empty. */
  value: string;
  onValueChange: (value: string) => void;
  /** Max decimals of each number and of the result (2 for amounts). */
  decimals?: number;
};

const operators: { operator: Operator; label: string }[] = [
  { operator: '+', label: 'Sumar' },
  { operator: '−', label: 'Restar' },
  { operator: '×', label: 'Multiplicar' },
  { operator: '÷', label: 'Dividir' },
];

/**
 * Amount field that also takes a calculation ("12.000 + 3.500 + 8.000 ÷ 4", #167): like
 * <NumberInput>, it shows numbers in the browser's language and hands back the normalized value,
 * here the result (updated while typing; an unfinished calculation keeps the last one). While
 * focused, a row of + − × ÷ shows below it (the phone's number pad doesn't have them) with the
 * result. On leaving the field it shows the result.
 *
 * The wrapper is `display: contents`, so the input and the row are laid out by the parent: in a
 * `flex flex-wrap` row the operators go to their own line.
 */
export function CalculatorInput({ value, onValueChange, decimals = 2, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // What's being typed while focused; null = showing the value.
  const [text, setText] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const pendingCaret = useRef<number | null>(null);

  const shown = text ?? formatValue(value, decimals);

  // Formatting moves the caret to the end: put it back where it was (the DOM is outside React).
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (pendingCaret.current === null || !input || document.activeElement !== input) return;
    input.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  });

  function apply(typed: string, caret: number) {
    const formatted = formatExpression(typed, decimals);
    pendingCaret.current = caretAfterFormat(typed, caret, formatted);
    setText(formatted);
    if (formatted === '') return onValueChange('');
    const result = evaluateExpression(formatted, decimals);
    if (result !== null) onValueChange(String(result));
  }

  function insert(operator: Operator) {
    const input = inputRef.current!;
    const start = input.selectionStart ?? shown.length;
    let before = shown.slice(0, start).trimEnd();
    if (before === '') return; // nothing to operate on yet
    // Tapping another operator right after one replaces it (5 + → 5 ×).
    if (isOperatorKey(before.at(-1))) before = before.slice(0, -1).trimEnd();
    const typed = `${before} ${operator} ${shown.slice(input.selectionEnd ?? start).trimStart()}`;
    input.focus();
    apply(typed, before.length + 2);
  }

  return (
    <div
      className="contents"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setFocused(false);
        setText(null);
      }}
    >
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={shown}
        onChange={(e) => apply(e.target.value, e.target.selectionStart ?? e.target.value.length)}
      />
      {focused && (
        <div
          role="group"
          aria-label="Cuentas"
          className="mt-2 flex basis-full flex-wrap items-center gap-1.5"
        >
          {operators.map(({ operator, label }) => (
            <Button
              key={operator}
              type="button"
              variant="outline"
              size="icon-lg"
              className="text-lg"
              aria-label={label}
              // Keeps the focus (and the phone's keyboard) in the field.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(operator)}
            >
              {operator}
            </Button>
          ))}
          {hasOperator(shown) && value !== '' && (
            <span className="ml-auto text-sm text-muted-foreground tabular">
              = {formatValue(value, decimals)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** The value as the field shows it ("1500.5" → "1.500,5" in es-AR). */
function formatValue(value: string, decimals: number): string {
  const number = toNumber(value);
  return number === null ? '' : formatNumber(number, decimals);
}
