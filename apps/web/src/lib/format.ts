import { currencies, expenseCategories } from '@kachingga/api/schemas';

export type Currency = (typeof currencies)[number];
export type ExpenseCategory = (typeof expenseCategories)[number];

// ─── Locale ───────────────────────────────────────────────────────────────────
// Everything the user sees (amounts, numbers, dates) follows the browser's language: "1.500,50"
// in es-AR, "1,500.50" in en-US. What the app keeps and sends is always normalized: numbers as
// plain numeric strings ("1500.5") or cents (150050), dates as calendar days ("2026-11-04").

/**
 * The browser's language (es-AR as a fallback). Spanish without a country ("es") or generic Latin
 * American Spanish ("es-419", what Chrome reports for Argentina) don't say which number format to
 * use, and es-419 writes "1,500.5": those go as es-AR, the app's main audience. A specific
 * country (es-MX, es-ES, en-US…) is respected.
 */
export function getLocale(): string {
  const language = (typeof navigator !== 'undefined' && navigator.language) || 'es-AR';
  return /^es(-419)?$/i.test(language) ? 'es-AR' : language;
}

/** Thousands and decimal separators of the browser's language. */
export function numberSeparators(): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(getLocale()).formatToParts(1234567.5);
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? '.',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? ',',
  };
}

/** Format cents as a localized currency string (150050 → "$ 1.500,50" in es-AR). */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** My balance as text: positive = they owe me ("Te deben $ 10,00"), negative = I owe ("Debés $ 10,00"). */
export function formatMyBalance(cents: number, currency: string): string {
  if (cents === 0) return 'Estás al día';
  return cents > 0
    ? `Te deben ${formatCents(cents, currency)}`
    : `Debés ${formatCents(-cents, currency)}`;
}

/** A localized number, e.g. an exchange rate (1555.5 → "1.555,5" in es-AR). */
export function formatNumber(value: number, maxDecimals = 4): string {
  return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: maxDecimals }).format(value);
}

/**
 * Cents as a plain localized amount to paste into a bank app: decimal separator of the
 * browser's language, no thousands separator (150050 → "1500,50" in es-AR).
 */
export function formatPlainAmount(cents: number): string {
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(cents / 100);
}

// ─── Normalized numbers (what number inputs hold) ───────────────────────────
// <NumberInput> shows the number formatted while typing and hands back a normalized numeric
// string ("1500.5", "" when empty). These convert between that and what the API uses.

/** A normalized numeric string as a number, or null if empty. */
export function toNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** A normalized numeric string as cents ("1500.5" → 150050); 0 if empty. */
export function toCents(value: string): number {
  return Math.round((toNumber(value) ?? 0) * 100);
}

/** Cents as a normalized numeric string (150050 → "1500.5"). */
export function centsToNumeric(cents: number): string {
  return String(cents / 100);
}

/** A number as a normalized numeric string with at most `maxDecimals` (1/1555 → "0.000643"). */
export function toNumeric(value: number, maxDecimals = 6): string {
  return String(Number(value.toFixed(maxDecimals)));
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

/** Format a stored date in the browser's language (4/11/2026 in es-AR), on its calendar day. */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'UTC' }).format(new Date(date));
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
