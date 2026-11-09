import type { ExpenseFilters } from '@kachingga/api/schemas';

import { centsToNumeric, endOfDay, startOfDay, toCents, toDay, toNumber } from '@/lib/format';

// The expense filters live in the URL (`/grupos/:id/filtros?pago=…&desde=…`), so they survive going
// to an expense and back, and a filtered list can be reloaded or shared. The URL keeps what the
// screen shows: days as YYYY-MM-DD and amounts as the normalized numbers the inputs hold ("1500.5");
// `toApiFilters` turns that into what the API takes (Dates, cents).

const PARAM = {
  paidById: 'pago',
  splitParticipantId: 'para',
  involvedParticipantId: 'involucrado',
  categoryIds: 'categorias',
  dateFrom: 'desde',
  dateTo: 'hasta',
  minAmount: 'min',
  maxAmount: 'max',
  search: 'q',
} as const;

export type UrlFilters = {
  paidById?: string;
  splitParticipantId?: string;
  involvedParticipantId?: string;
  /** Ids of the group's categories */
  categoryIds?: string[];
  /** YYYY-MM-DD */
  dateFrom?: string;
  /** YYYY-MM-DD */
  dateTo?: string;
  /** Normalized number, as typed ("1500.5") */
  minAmount?: string;
  maxAmount?: string;
  search?: string;
};

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isAmount = (value: string) => toNumber(value) !== null && Number(value) >= 0;

/** Reads the filters from the URL, ignoring anything malformed (a hand-edited link can't break the screen). */
export function readUrlFilters(params: URLSearchParams): UrlFilters {
  const text = (key: string) => params.get(key)?.trim() || undefined;
  const day = (key: string) => {
    const value = text(key);
    return value && isDay(value) ? value : undefined;
  };
  const amount = (key: string) => {
    const value = text(key);
    return value && isAmount(value) ? value : undefined;
  };
  const categoryIds = text(PARAM.categoryIds)
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return {
    paidById: text(PARAM.paidById),
    splitParticipantId: text(PARAM.splitParticipantId),
    involvedParticipantId: text(PARAM.involvedParticipantId),
    categoryIds: categoryIds?.length ? categoryIds : undefined,
    dateFrom: day(PARAM.dateFrom),
    dateTo: day(PARAM.dateTo),
    minAmount: amount(PARAM.minAmount),
    maxAmount: amount(PARAM.maxAmount),
    search: text(PARAM.search),
  };
}

/** The URL search params for some filters (empty ones are left out). */
export function writeUrlFilters(filters: UrlFilters): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | undefined) => {
    if (value) params.set(key, value);
  };
  set(PARAM.paidById, filters.paidById);
  set(PARAM.splitParticipantId, filters.splitParticipantId);
  set(PARAM.involvedParticipantId, filters.involvedParticipantId);
  set(PARAM.categoryIds, filters.categoryIds?.join(','));
  set(PARAM.dateFrom, filters.dateFrom);
  set(PARAM.dateTo, filters.dateTo);
  set(PARAM.minAmount, filters.minAmount);
  set(PARAM.maxAmount, filters.maxAmount);
  set(PARAM.search, filters.search);
  return params;
}

/** What the API takes (`expenses.list`, `expenses.summary`, `expenses.export`, saved filters). */
export function toApiFilters(filters: UrlFilters): ExpenseFilters {
  return withoutEmpty({
    paidById: filters.paidById,
    splitParticipantId: filters.splitParticipantId,
    involvedParticipantId: filters.involvedParticipantId,
    categoryIds: filters.categoryIds,
    dateFrom: filters.dateFrom ? startOfDay(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? endOfDay(filters.dateTo) : undefined,
    minAmountCents: filters.minAmount ? toCents(filters.minAmount) : undefined,
    maxAmountCents: filters.maxAmount ? toCents(filters.maxAmount) : undefined,
    search: filters.search,
  });
}

// Leaves out unset keys, so the same filters always make the same query key and saved filter.
function withoutEmpty<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** A saved filter (as the API stores it) back to what the URL holds. */
export function fromApiFilters(filters: ExpenseFilters): UrlFilters {
  return {
    paidById: filters.paidById,
    splitParticipantId: filters.splitParticipantId,
    involvedParticipantId: filters.involvedParticipantId,
    categoryIds: filters.categoryIds,
    dateFrom: filters.dateFrom ? toDay(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? toDay(filters.dateTo) : undefined,
    minAmount: filters.minAmountCents != null ? centsToNumeric(filters.minAmountCents) : undefined,
    maxAmount: filters.maxAmountCents != null ? centsToNumeric(filters.maxAmountCents) : undefined,
    search: filters.search,
  };
}
