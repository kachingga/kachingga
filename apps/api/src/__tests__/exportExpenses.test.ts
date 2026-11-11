import { describe, expect, test } from 'bun:test'
import { exportFilename, jsonRow, toCsv, toExportRows, toJson, type ExpenseForExport } from '../lib/exportExpenses'

const ana = { id: 'a', name: 'Ana' }
const beto = { id: 'b', name: 'Beto' }

const base: ExpenseForExport = {
  date: new Date('2026-11-02T12:00:00Z'),
  description: 'Asado',
  category: { name: 'Comida' },
  amountCents: 300000,
  currency: 'ARS',
  exchangeRate: null,
  splitType: 'EQUAL',
  paidBy: ana,
  splits: [
    { amountCents: 150000, participant: ana },
    { amountCents: 150000, participant: beto },
  ],
}

describe('toExportRows', () => {
  test('base currency: same amount, my share', () => {
    const [row] = toExportRows('ARS', 'b', [base])
    expect(row).toMatchObject({
      fecha: '2026-11-02',
      categoria: 'Comida',
      moneda: 'ARS',
      monto: 3000,
      tipo_de_cambio: null,
      moneda_saldo: 'ARS',
      monto_en_moneda_saldo: 3000,
      pago: 'Ana',
      division: 'Partes iguales',
      mi_parte: 1500,
      mi_parte_en_moneda_saldo: 1500,
    })
  })

  test('converted USD: amounts in the base currency use the stored rate', () => {
    const usd = {
      ...base,
      currency: 'USD' as const,
      exchangeRate: 1555,
      amountCents: 2000,
      splits: [{ amountCents: 2000, participant: beto }],
    }
    const [row] = toExportRows('ARS', 'b', [usd])
    expect(row).toMatchObject({
      moneda: 'USD',
      monto: 20,
      moneda_saldo: 'ARS',
      monto_en_moneda_saldo: 31100,
      mi_parte: 20,
      mi_parte_en_moneda_saldo: 31100,
    })
  })

  test('kept USD stays in USD; not in the split → my share is 0', () => {
    const kept = { ...base, currency: 'USD' as const, amountCents: 6000, splits: [{ amountCents: 6000, participant: ana }] }
    const [row] = toExportRows('ARS', 'b', [kept])
    expect(row).toMatchObject({ moneda_saldo: 'USD', monto_en_moneda_saldo: 60, mi_parte: 0 })
  })
})

describe('toCsv', () => {
  test('header, BOM, dot decimals and escaped text', () => {
    const tricky = { ...base, description: 'Pizza, birra y "postre"\nen lo de Ana' }
    const csv = toCsv(toExportRows('ARS', 'a', [tricky]))
    expect(csv.startsWith('﻿fecha,descripcion,categoria,')).toBe(true)
    const lines = csv.split('\r\n')
    expect(lines[1]).toContain('"Pizza, birra y ""postre""\nen lo de Ana"')
    expect(lines[1]).toContain(',3000.00,')
    expect(lines[1]).toContain('Ana: 1500.00 | Beto: 1500.00')
  })

  test("text that starts like a formula gets a leading ' (no formulas in someone else's sheet)", () => {
    const evil = {
      ...base,
      description: '=HYPERLINK("http://evil.example","clic")',
      category: { name: '+cmd' },
      paidBy: { id: 'a', name: '@Ana' },
      splits: [
        { amountCents: 150000, participant: { id: 'a', name: '-Ana' } },
        { amountCents: 150000, participant: { id: 'b', name: '\tBeto' } },
      ],
    }
    const [, line] = toCsv(toExportRows('ARS', 'a', [evil])).split('\r\n')
    expect(line).toContain(`,"'=HYPERLINK(""http://evil.example"",""clic"")",'+cmd,`)
    expect(line).toContain(",'@Ana,")
    expect(line).toContain(",'-Ana: 1500.00 | \tBeto: 1500.00,")
    expect(toCsv(toExportRows('ARS', 'a', [{ ...base, description: '\rx' }]))).toContain(`,"'\rx",`)
    // Numbers and normal text are untouched
    expect(line).toContain(',3000.00,')
    expect(toCsv(toExportRows('ARS', 'a', [base]))).toContain(',Asado,Comida,')
  })

  test('empty export still has the header', () => {
    expect(toCsv([])).toBe(
      '﻿fecha,descripcion,categoria,moneda,monto,tipo_de_cambio,moneda_saldo,monto_en_moneda_saldo,pago,division,partes,mi_parte,mi_parte_en_moneda_saldo\r\n',
    )
  })
})

describe('toJson', () => {
  const info = { grupo: 'Viaje', moneda_base: 'ARS' as const, exportado: '2026-11-03T10:00:00.000Z', filtros: { search: 'asado' } }

  test('what was exported, indented, and one expense per line', () => {
    const rows = toExportRows('ARS', 'a', [base, { ...base, description: 'Pizza\n"y birra"' }])
    const json = toJson(info, rows.map(jsonRow))
    expect(JSON.parse(json)).toEqual({ ...info, gastos: JSON.parse(JSON.stringify(rows)) })
    const lines = json.split('\n')
    expect(lines.slice(0, 3)).toEqual(['{', '  "grupo": "Viaje",', '  "moneda_base": "ARS",'])
    expect(lines.filter((l) => l.startsWith('    {"fecha":'))).toHaveLength(2)
    expect(json.endsWith('  ]\n}\n')).toBe(true)
  })

  test('no expenses: an empty list', () => {
    expect(JSON.parse(toJson(info, []))).toEqual({ ...info, gastos: [] })
  })
})

test('exportFilename', () => {
  expect(exportFilename('Viaje a Bariloche ñ!', 'csv', new Date('2026-11-03T10:00:00Z'))).toBe(
    'kachingga-viaje-a-bariloche-n-2026-11-03.csv',
  )
})
