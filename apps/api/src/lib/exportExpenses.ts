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
// The file is CSV_HEADER + csvRows of each batch of rows (the export builds it batch by batch).
export const CSV_HEADER = '﻿' + CSV_COLUMNS.join(',') + '\r\n'

/** The CSV lines of some rows, each one ending in CRLF. */
export function csvRows(rows: ExportRow[]) {
  return rows
    .map(
      (r) =>
        CSV_COLUMNS.map((c) => {
          if (c === 'partes') return csvCell(r.partes.map((p) => `${p.participante}: ${p.monto.toFixed(2)}`).join(' | '))
          if (c === 'tipo_de_cambio') return r.tipo_de_cambio === null ? '' : String(r.tipo_de_cambio)
          return csvCell(r[c])
        }).join(',') + '\r\n',
    )
    .join('')
}

export const toCsv = (rows: ExportRow[]) => CSV_HEADER + csvRows(rows)

export type ExportInfo = { grupo: string; moneda_base: Currency; exportado: string; filtros: unknown }

/**
 * The JSON file: what was exported (indented) and `gastos`, one expense per line (`jsonRow` of each
 * row, so the export can build them batch by batch). Indenting every expense doubled the file.
 */
export function toJson(info: ExportInfo, gastos: string[]) {
  const head = JSON.stringify(info, null, 2).slice(0, -2) // without the closing "\n}"
  const list = gastos.length ? `\n    ${gastos.join(',\n    ')}\n  ` : ''
  return `${head},\n  "gastos": [${list}]\n}\n`
}

export const jsonRow = (row: ExportRow) => JSON.stringify(row)

export function exportFilename(groupName: string, extension: 'csv' | 'json', now = new Date()) {
  const slug = groupName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `kachingga-${slug || 'grupo'}-${now.toISOString().slice(0, 10)}.${extension}`
}
