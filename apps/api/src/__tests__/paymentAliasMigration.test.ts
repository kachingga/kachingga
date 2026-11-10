// The data migration of #106: participants without account lose the group alias someone else set for them.
// Runs the real migration SQL on an in-memory Postgres (PGlite).
import { PGlite } from '@electric-sql/pglite'
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SQL = readFileSync(join(import.meta.dir, '../db/migrations/20261110180000_alias_solo_propio/migration.sql'), 'utf8')

test('clears the alias of participants without account and keeps everyone else', async () => {
  const pg = new PGlite()
  await pg.exec('CREATE TABLE "Participant" ("id" TEXT PRIMARY KEY, "userId" TEXT, "paymentAlias" TEXT)')
  await pg.exec(`INSERT INTO "Participant" VALUES
    ('juan', NULL, 'robo.mp'),
    ('sofi', NULL, NULL),
    ('tuke', 'u-tuke', 'tuke.viajes'),
    ('yo', 'u-yo', NULL)`)
  await pg.exec(SQL)
  const { rows } = await pg.query<{ id: string; paymentAlias: string | null }>(
    'SELECT "id", "paymentAlias" FROM "Participant" ORDER BY "id"',
  )
  expect(Object.fromEntries(rows.map((r) => [r.id, r.paymentAlias]))).toEqual({ juan: null, sofi: null, tuke: 'tuke.viajes', yo: null })
})
