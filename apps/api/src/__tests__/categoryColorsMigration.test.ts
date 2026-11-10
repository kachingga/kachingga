// The data migration of category colors (#84): old theme color names → the new category palette.
// Runs the real migration SQL on an in-memory Postgres (PGlite) with categories in the old colors.
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { categoryColors, defaultCategories } from '../schemas'

const SQL = readFileSync(join(import.meta.dir, '../db/migrations/20261110120000_colores_de_categorias/migration.sql'), 'utf8')

async function migrate(rows: { id: string; defaultKey: string | null; color: string }[]) {
  const pg = new PGlite()
  await pg.exec('CREATE TABLE "Category" ("id" TEXT PRIMARY KEY, "defaultKey" TEXT, "color" TEXT NOT NULL)')
  for (const r of rows) {
    await pg.query('INSERT INTO "Category" ("id", "defaultKey", "color") VALUES ($1, $2, $3)', [r.id, r.defaultKey, r.color])
  }
  await pg.exec(SQL)
  const { rows: out } = await pg.query<{ id: string; color: string }>('SELECT "id", "color" FROM "Category" ORDER BY "id"')
  return Object.fromEntries(out.map((r) => [r.id, r.color]))
}

// The colors the 8 built-in categories had before this migration.
const OLD_DEFAULTS: Record<string, string> = {
  FOOD: 'chart-2',
  GROCERIES: 'chart-1',
  TRANSPORT: 'chart-4',
  LODGING: 'chart-5',
  ENTERTAINMENT: 'chart-3',
  SHOPPING: 'highlight',
  SERVICES: 'positive',
  OTHER: 'muted',
}

describe('category colors migration', () => {
  test('built-in categories with their original color get their new default color', async () => {
    const colors = await migrate(defaultCategories.map((d) => ({ id: d.key, defaultKey: d.key, color: OLD_DEFAULTS[d.key]! })))
    expect(colors).toEqual(Object.fromEntries(defaultCategories.map((d) => [d.key, d.color])))
  })

  test('recolored built-in and custom categories get the closest new color', async () => {
    const colors = await migrate([
      { id: 'food-recolored', defaultKey: 'FOOD', color: 'chart-4' },
      { id: 'nafta', defaultKey: null, color: 'chart-1' },
      { id: 'regalos', defaultKey: null, color: 'negative' },
      { id: 'mascotas', defaultKey: null, color: 'primary' },
    ])
    expect(colors).toEqual({ 'food-recolored': 'sky', nafta: 'mint', regalos: 'raspberry', mascotas: 'teal' })
  })

  test('every old color ends up in the new palette', async () => {
    const old = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'positive', 'negative', 'highlight', 'primary', 'muted']
    const colors = await migrate(old.map((color) => ({ id: color, defaultKey: null, color })))
    for (const color of Object.values(colors)) expect(categoryColors).toContain(color as (typeof categoryColors)[number])
  })
})
