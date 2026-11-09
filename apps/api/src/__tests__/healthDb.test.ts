// GET /health/db: answers ok only if the database answers (for the uptime monitor).
import { beforeEach, describe, expect, mock, test } from 'bun:test'

const queryRaw = mock(async () => [{ '?column?': 1 }])
mock.module('../db', () => ({ prisma: { $queryRaw: queryRaw } }))

const { default: server } = await import('../index')
const call = (headers?: HeadersInit) => server.fetch(new Request('http://test/health/db', { headers }))

describe('GET /health/db', () => {
  beforeEach(() => queryRaw.mockClear())

  test('database answers → 200 { ok: true }', async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })

  test('database down or paused → 503 { ok: false }, without details', async () => {
    queryRaw.mockImplementationOnce(async () => {
      throw new Error("Can't reach database server at db.example:5432")
    })
    const res = await call()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false })
  })

  test('rate limited per IP like the rest of the API', async () => {
    const ip = { 'x-forwarded-for': '203.0.113.9' }
    let last = 0
    for (let i = 0; i < 301; i++) last = (await call(ip)).status
    expect(last).toBe(429)
  })
})
