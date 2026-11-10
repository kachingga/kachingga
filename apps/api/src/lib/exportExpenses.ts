import type { Currency, SplitType } from '../db/generated/prisma/enums'
import { balanceCurrency } from './balances'

export type ExpenseForExport = {
  date: Date
  description: string
  category: { name: string }
  amountCents: number
  currency: Currency
  exchangeRate: number | null
  splitType: SplitType
  paidBy: { id: string; name: string }
  splits: { amountCents: number; participant: { id: string; name: string } }[]
}

export type ExportRow = {
  fecha: string // YYYY-MM-DD
  descripcion: string
  categoria: string
  moneda: Currency
  monto: number
  tipo_de_cambio: number | null // 1 unit of `moneda` = tipo_de_cambio of the base currency; null = not converted
  moneda_saldo: Currency // the balance this expense counts in (base, or its own if kept)
  monto_en_moneda_saldo: number
  pago: string
  division: string
  partes: { participante: string; monto: number }[] // in `moneda`
  mi_parte: number // in `moneda`; 0 if I'm not in the split
  mi_parte_en_moneda_saldo: number
}

const SPLIT_LABELS: Record<SplitType, string> = { EQUAL: 'Partes iguales', AMOUNT: 'Por monto', PERCENTAGE: 'Por porcentaje' }

const units = (cents: number) => cents / 100

// One flat row per expense, with the same currency/rounding rules as balances and summary.
export function toExportRows(baseCurrency: Currency, meId: string, expenses: ExpenseForExport[]): ExportRow[] {
  return expenses.map((e) => {
    const { currency, rate } = balanceCurrency(e, baseCurrency)
    const converted = e.splits.map((s) => ({ id: s.participant.id, cents: Math.round(s.amountCents * rate) }))
    const mine = e.splits.find((s) => s.participant.id === meId)
    return {
      fecha: e.date.toISOString().slice(0, 10),
      descripcion: e.description,
      categoria: e.category.name,
      moneda: e.currency,
      monto: units(e.amountCents),
      tipo_de_cambio: e.exchangeRate,
      moneda_saldo: currency,
      monto_en_moneda_saldo: units(converted.reduce((a, s) => a + s.cents, 0)),
      pago: e.paidBy.name,
      division: SPLIT_LABELS[e.splitType],
      partes: e.splits.map((s) => ({ participante: s.participant.name, monto: units(s.amountCents) })),
      mi_parte: units(mine?.amountCents ?? 0),
      mi_parte_en_moneda_saldo: units(converted.find((s) => s.id === meId)?.cents ?? 0),
    }
  })
}

const CSV_COLUMNS = [
  'fecha',
  'descripcion',
  'categoria',
  'moneda',
  'monto',
  'tipo_de_cambio',
  'moneda_saldo',
  'monto_en_moneda_saldo',
  'pago',
  'division',
  'partes',
  'mi_parte',
  'mi_parte_en_moneda_saldo',
] as const

// A text cell starting like a formula (=, +, -, @, tab, CR) gets a leading ' so Excel / Sheets show it as
// text: otherwise anyone in the group could put a formula in a description and run it in another's sheet.
const FORMULA_START = /^[=+\-@\t\r]/

function csvCell(value: string | number | null) {
  if (value === null) return ''
  const text = typeof value === 'number' ? value.toFixed(2) : FORMULA_START.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// Standard CSV (comma, dot decimals, UTF-8 with BOM so Excel shows accents). `partes` goes as "Ana: 10.00 | Beto: 5.00".
export function toCsv(rows: ExportRow[]) {
  const lines = rows.map((r) =>
    CSV_COLUMNS.map((c) => {
      if (c === 'partes') return csvCell(r.partes.map((p) => `${p.participante}: ${p.monto.toFixed(2)}`).join(' | '))
      if (c === 'tipo_de_cambio') return r.tipo_de_cambio === null ? '' : String(r.tipo_de_cambio)
      return csvCell(r[c])
    }).join(','),
  )
  return '﻿' + [CSV_COLUMNS.join(','), ...lines].join('\r\n') + '\r\n'
}

export function exportFilename(groupName: string, extension: 'csv' | 'json', now = new Date()) {
  const slug = groupName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `kachingga-${slug || 'grupo'}-${now.toISOString().slice(0, 10)}.${extension}`
}
