// Database size guard (MAX_DB_MB): fake size, clock and Sentry. Wiring to the procedures and the
// real size query (PGlite): integration/limits.test.ts.
import { describe, expect, mock, test } from 'bun:test'
import { TRPCError } from '@trpc/server'
import { CHECK_EVERY_MS, createDbSizeGuard, DB_FULL_MESSAGE } from '../lib/dbSize'

const MB = 1024 * 1024

function setup(sizeMb: number) {
  let now = 0
  let bytes = sizeMb * MB
  const measure = mock(async () => bytes)
  const report = mock((_error: unknown) => true)
  const guard = createDbSizeGuard({ measure, report, now: () => now })
  return {
    guard,
    measure,
    report,
    advance: (ms: number) => (now += ms),
    resize: (mb: number) => (bytes = mb * MB),
  }
}

const outcome = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (e: unknown) => (e instanceof TRPCError ? `${e.code}: ${e.message}` : String(e)),
  )

describe('database size guard', () => {
  test('MAX_DB_MB unset or empty: no guard, the size is never read', async () => {
    const { guard, measure } = setup(10_000)
    expect(await outcome(guard(Number(undefined)))).toBe('ok')
    expect(await outcome(guard(Number('')))).toBe('ok')
    expect(measure).not.toHaveBeenCalled()
  })

  test('under the limit: allowed, and the size is read once per period', async () => {
    const { guard, measure, report, advance } = setup(300)
    for (let i = 0; i < 5; i++) expect(await outcome(guard(400))).toBe('ok')
    expect(measure).toHaveBeenCalledTimes(1)
    advance(CHECK_EVERY_MS)
    await guard(400)
    expect(measure).toHaveBeenCalledTimes(2)
    expect(report).not.toHaveBeenCalled()
  })

  test('over the limit: rejected with the message, reported once per period; allowed again once it shrinks', async () => {
    const { guard, measure, report, advance, resize } = setup(401)
    for (let i = 0; i < 5; i++) expect(await outcome(guard(400))).toBe(`SERVICE_UNAVAILABLE: ${DB_FULL_MESSAGE}`)
    expect(measure).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledTimes(1)
    expect(String(report.mock.calls[0]![0])).toContain('401 MB, over MAX_DB_MB (400 MB)')

    advance(CHECK_EVERY_MS)
    await outcome(guard(400))
    expect(report).toHaveBeenCalledTimes(2)

    // Rows deleted (or the limit raised): it takes effect at the next read
    resize(350)
    expect(await outcome(guard(400))).toBe(`SERVICE_UNAVAILABLE: ${DB_FULL_MESSAGE}`)
    advance(CHECK_EVERY_MS)
    expect(await outcome(guard(400))).toBe('ok')
    expect(report).toHaveBeenCalledTimes(2)
  })
})
