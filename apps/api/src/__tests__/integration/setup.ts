// Integration-test harness: real routers + real Prisma against an in-memory Postgres (PGlite)
// built from the real migrations. No network, no Supabase, no .env.
//
// Usage (at the top of a test file, before importing anything that uses the DB):
//   const { caller, prisma } = await setupTestApi()
import { PGlite } from '@electric-sql/pglite'
import { mock } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { User } from '@supabase/supabase-js'
import { PrismaPGlite } from 'pglite-prisma-adapter'
import { PrismaClient } from '../../db/generated/prisma/client'

const MIGRATIONS_DIR = join(import.meta.dir, '../../db/migrations')

export async function setupTestApi() {
  const pg = new PGlite()
  // The real migrations enable RLS on _prisma_migrations, so it must exist first.
  await pg.exec('CREATE TABLE "_prisma_migrations" (id varchar(36) PRIMARY KEY)')
  const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  for (const name of migrations) await pg.exec(readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8'))

  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pg) })
  mock.module('../../db', () => ({ prisma }))

  const { appRouter } = await import('../../trpc/router')
  const { createCallerFactory } = await import('../../trpc/init')
  const createCaller = createCallerFactory(appRouter)

  // A tRPC caller authenticated as a fake Supabase user.
  const caller = (userId: string) => createCaller({ user: { id: userId, email: `${userId}@test.dev` } as User })

  // Id of one of the group's built-in categories (FOOD, OTHER…), as a member sees it.
  const categoryId = async (userId: string, groupId: string, key: string) =>
    (await caller(userId).categories.list({ groupId })).find((c) => c.defaultKey === key)!.id

  return { caller, prisma, anonymous: createCaller({ user: null }), categoryId }
}

// Blue rate used whenever a test triggers the automatic conversion (fetch is stubbed, no network).
export function stubBlueRate(compra = 1545, venta = 1565) {
  globalThis.fetch = mock(async () =>
    Response.json({ compra, venta, fechaActualizacion: '2026-11-02T20:58:00.000Z' }),
  ) as unknown as typeof fetch
}
