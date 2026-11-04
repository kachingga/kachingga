import { currencies, expenseCategories } from '@kachingga/api/schemas';

export type Currency = (typeof currencies)[number];
export type ExpenseCategory = (typeof expenseCategories)[number];

/** Format cents as a localized currency string (e.g. 150050 → "$1.500,50"). */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Parse a user-typed decimal number. Accepts the Argentine format ("1.500,50", "1.500", "0,5")
 * and a plain dot as decimal separator ("1500.50", "12.5"). Returns null if it isn't a number.
 *
 * Rules: with both separators, the last one is the decimal one. With only commas, a single
 * comma is decimal. With only dots, it's a thousands separator when there are several, or one
 * followed by exactly 3 digits after a non-zero integer part ("1.500" → 1500, "0.500" → 0.5).
 */
export function parseDecimal(value: string): number | null {
  let s = value.trim().replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(s) && !/^[.,]\d+$/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    if (s.indexOf(',') !== lastComma) return null;
    s = s.replace(',', '.');
  } else if (lastDot !== -1) {
    const isThousands =
      s.indexOf('.') !== lastDot || (/^\d+\.\d{3}$/.test(s) && !s.startsWith('0.'));
    if (isThousands) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
      s = s.split('.').join('');
    }
  }

  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

/** Parse a user-typed amount to cents ("1.500,50" → 150050). Returns 0 if invalid. */
export function parseCents(value: string): number {
  const num = parseDecimal(value);
  return num === null ? 0 : Math.round(num * 100);
}

/** Cents as an editable input value, Argentine style without thousands (12345 → "123,45"). */
export function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** A decimal number as an editable input value (1555.5 → "1555,5", up to `maxDecimals`). */
export function decimalToDisplay(value: number, maxDecimals = 4): string {
  return String(Number(value.toFixed(maxDecimals))).replace('.', ',');
}

// ─── Dates ────────────────────────────────────────────────────────────────────
// Expense and settlement dates are calendar days, not instants: they're stored at 12:00 UTC
// and always read in UTC, so everyone sees the same day whatever their time zone.
// A "day" here is a YYYY-MM-DD string (the value of <input type="date">).

/** The calendar day of a stored date (YYYY-MM-DD). */
export function toDay(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** Today in the user's time zone (YYYY-MM-DD). */
export function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dayParts(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y!, m! - 1, d!];
}

/** The date to store for a calendar day (12:00 UTC). */
export function dayToDate(day: string): Date {
  return new Date(Date.UTC(...dayParts(day), 12));
}

/** Start of a calendar day, for "from" filters. */
export function startOfDay(day: string): Date {
  return new Date(Date.UTC(...dayParts(day)));
}

/** End of a calendar day, for "to" filters. */
export function endOfDay(day: string): Date {
  return new Date(Date.UTC(...dayParts(day), 23, 59, 59, 999));
}

/** First and last day of the month of `day` (YYYY-MM-DD). */
export function monthRange(day: string): { from: string; to: string } {
  const [y, m] = dayParts(day);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  return { from: `${prefix}-01`, to: `${prefix}-${String(last).padStart(2, '0')}` };
}

/** Format a stored date as DD/MM/YYYY (its calendar day, see above). */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC' }).format(new Date(date));
}

export const categoryLabels: Record<ExpenseCategory, string> = {
  FOOD: 'Comida',
  GROCERIES: 'Súper',
  TRANSPORT: 'Transporte',
  LODGING: 'Alojamiento',
  ENTERTAINMENT: 'Salidas',
  SHOPPING: 'Compras',
  SERVICES: 'Servicios',
  OTHER: 'Otros',
};

export const splitTypeLabels: Record<'EQUAL' | 'AMOUNT' | 'PERCENTAGE', string> = {
  EQUAL: 'partes iguales',
  AMOUNT: 'por monto',
  PERCENTAGE: 'por porcentaje',
};

export const currencyLabels: Record<Currency, string> = {
  ARS: 'Pesos (ARS)',
  USD: 'Dólares (USD)',
  EUR: 'Euros (EUR)',
  BRL: 'Reales (BRL)',
  UYU: 'Pesos uruguayos (UYU)',
  CLP: 'Pesos chilenos (CLP)',
};
