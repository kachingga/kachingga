// Single place for user-facing money/date formatting (es-AR). The API sends integer cents.

export function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amountCents / 100);
}

// Parses what the user typed ("1.234,56", "1234.5", "20") into integer cents. null if invalid.
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(cleaned)) return null;
  const lastSep = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  const decimals = lastSep >= 0 ? cleaned.slice(lastSep + 1) : '';
  // A separator followed by 1-2 digits is the decimal one; anything else is a thousands separator.
  const isDecimal = lastSep >= 0 && decimals.length > 0 && decimals.length <= 2;
  const integerPart = (isDecimal ? cleaned.slice(0, lastSep) : cleaned).replace(/[.,]/g, '');
  const cents = Number(integerPart) * 100 + (isDecimal ? Number(decimals.padEnd(2, '0')) : 0);
  return Number.isSafeInteger(cents) ? cents : null;
}
