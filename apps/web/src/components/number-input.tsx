import type { InputHTMLAttributes } from 'react';
import { NumericFormat } from 'react-number-format';

import { Input } from '@/components/ui/input';
import { numberSeparators } from '@/lib/format';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'type' | 'size'
> & {
  /** Normalized numeric string ("1500.5"), "" when empty. */
  value: string;
  onValueChange: (value: string) => void;
  /** Max decimals the user can type (2 for amounts). */
  decimals?: number;
};

/**
 * Number field that shows what the user types formatted in the browser's language
 * ("1.500,5" in es-AR) and hands back the normalized value ("1500.5"). Only the language's decimal
 * separator types decimals: in es-AR, a "." typed out of habit ("1.500") is ignored, so it's 1500.
 */
export function NumberInput({ value, onValueChange, decimals = 2, ...props }: Props) {
  const { group, decimal } = numberSeparators();
  return (
    <NumericFormat
      {...props}
      customInput={Input}
      value={value}
      valueIsNumericString
      onValueChange={(values) => onValueChange(values.value)}
      thousandSeparator={group}
      decimalSeparator={decimal}
      allowedDecimalSeparators={[decimal]}
      decimalScale={decimals}
      allowNegative={false}
      inputMode="decimal"
    />
  );
}
