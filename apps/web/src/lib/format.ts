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

/** Format a Date or ISO string as DD/MM/YYYY. */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('es-AR').format(new Date(date));
}

/** Convert a Date to YYYY-MM-DD for <input type="date">. */
export function toDateInput(date: Date | string): string {
  return new Date(date).toISOString().split('T')[0]!;
}

/** Today as YYYY-MM-DD for <input type="date">. */
export function todayInput(): string {
  return toDateInput(new Date());
}

/** Parse a user-typed decimal string (e.g. "100.50" or "100,50") to cents. Returns 0 if invalid. */
export function parseCents(value: string): number {
  const num = parseFloat(value.replace(',', '.'));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

/** Convert cents to a display decimal string (e.g. 12345 → "123.45"). */
export function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
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

export const currencyLabels: Record<Currency, string> = {
  ARS: 'Pesos (ARS)',
  USD: 'Dólares (USD)',
  EUR: 'Euros (EUR)',
  BRL: 'Reales (BRL)',
  UYU: 'Pesos uruguayos (UYU)',
  CLP: 'Pesos chilenos (CLP)',
};
