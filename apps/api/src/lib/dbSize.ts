import { TRPCError } from '@trpc/server'
import { prisma } from '../db'
import { reportError } from './monitoring'

// Guard against filling the database (Supabase Free: 500 MB for prod and staging together, then the
// app stops working for everyone: INFRA.md → "Plan de Supabase"). With MAX_DB_MB set, the mutations
// that create rows (CREATING_PROCEDURES in lib/rateLimit.ts) are rejected while the database is over
// that size; updates and deletes keep working. Unset (local, tests, CI): no guard. The size is read
// at most every CHECK_EVERY_MS, and reported to Sentry each time it's read over the limit.

export const CHECK_EVERY_MS = 10 * 60_000
export const DB_FULL_MESSAGE = 'Kachingga no puede guardar más cosas por ahora. Avisanos a hola@kachingga.com.'
const MB = 1024 * 1024

async function databaseBytes() {
  const [row] = await prisma.$queryRaw<[{ bytes: bigint }]>`SELECT pg_database_size(current_database()) AS bytes`
  return Number(row.bytes)
}

export function createDbSizeGuard({ measure = databaseBytes, report = reportError, now = Date.now } = {}) {
  let last: { bytes: number; at: number } | undefined
  return async function assertDatabaseHasRoom(maxMb = Number(process.env.MAX_DB_MB)) {
    if (!(maxMb > 0)) return
    if (!last || now() - last.at >= CHECK_EVERY_MS) {
      last = { bytes: await measure(), at: now() }
      if (last.bytes > maxMb * MB) {
        report(new Error(`Database is ${Math.round(last.bytes / MB)} MB, over MAX_DB_MB (${maxMb} MB): creating is blocked`))
      }
    }
    if (last.bytes > maxMb * MB) throw new TRPCError({ code: 'SERVICE_UNAVAILABLE', message: DB_FULL_MESSAGE })
  }
}

export const assertDatabaseHasRoom = createDbSizeGuard()
