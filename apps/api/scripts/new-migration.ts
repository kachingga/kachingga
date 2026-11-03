// Usage: bun run db:migrate:new <name>
// Writes the SQL to go from the current DB (DIRECT_URL) to the Prisma schema. Never touches the DB.
// Apply it with `bun run db:migrate:deploy` after reviewing it.
import { mkdirSync, writeFileSync } from 'node:fs'

const name = process.argv[2]?.toLowerCase().replace(/[^a-z0-9]+/g, '_')
if (!name) {
  console.error('Uso: bun run db:migrate:new <nombre>')
  process.exit(1)
}

const diff = Bun.spawnSync(['bunx', 'prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'src/db', '--script'], {
  stderr: 'inherit',
})
if (diff.exitCode !== 0) process.exit(diff.exitCode ?? 1)

const sql = diff.stdout.toString().trim()
if (!sql || sql === '-- This is an empty migration.') {
  console.log('El schema ya coincide con la base: no hay nada que migrar.')
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
const dir = `src/db/migrations/${stamp}_${name}`
mkdirSync(dir, { recursive: true })
const newTables = [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1])
const rls = newTables.map((t) => `ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`).join('\n')
writeFileSync(`${dir}/migration.sql`, rls ? `${sql}\n\n-- Block Supabase's REST API on new tables (see CLAUDE.md)\n${rls}\n` : `${sql}\n`)
console.log(`Creada ${dir}/migration.sql — revisala antes de aplicarla con: bun run db:migrate:deploy`)
