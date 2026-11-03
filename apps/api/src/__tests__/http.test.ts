// HTTP wiring: Hono + tRPC adapter + superjson, through the real server's fetch handler (no network).
import { describe, expect, test } from 'bun:test'
import superjson from 'superjson'
import server from '../index'

const call = (path: string, init?: RequestInit) => server.fetch(new Request(`http://test${path}`, init))

describe('http', () => {
  test('GET /health', async () => {
    const res = await call('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  test('tRPC query over HTTP keeps types with superjson (Date stays a Date)', async () => {
    const res = await call('/trpc/health.ping')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { data: Parameters<typeof superjson.deserialize>[0] } }
    const data = superjson.deserialize<{ ok: boolean; time: Date }>(body.result.data)
    expect(data.ok).toBe(true)
    expect(data.time).toBeInstanceOf(Date)
  })

  test('protected procedure without token → 401 UNAUTHORIZED', async () => {
    const res = await call('/trpc/groups.list')
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { json: { data: { code: string } } } }
    expect(body.error.json.data.code).toBe('UNAUTHORIZED')
  })

  test('unknown procedure → 404', async () => {
    expect((await call('/trpc/nope.nada')).status).toBe(404)
  })

  test('CORS: allows the web front origin, not others', async () => {
    const preflight = (origin: string) =>
      call('/trpc/groups.list', {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
      })
    const allowed = await preflight('http://localhost:5173')
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(allowed.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization')
    const blocked = await preflight('https://evil.example')
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('rate limit: too many invite-code attempts from one IP → 429 TOO_MANY_REQUESTS (even without login)', async () => {
    const attempt = () =>
      call('/trpc/groups.preview?input=' + encodeURIComponent(JSON.stringify({ json: { inviteCode: 'ABCDEFGH' } })), {
        headers: { 'x-forwarded-for': '198.51.100.23' },
      })
    for (let i = 0; i < 20; i++) expect((await attempt()).status).toBe(401) // UNAUTHORIZED: counted, not blocked yet
    const blocked = await attempt()
    expect(blocked.status).toBe(429)
    const body = (await blocked.json()) as { error: { json: { message: string; data: { code: string } } } }
    expect(body.error.json.data.code).toBe('TOO_MANY_REQUESTS')
    expect(body.error.json.message).toContain('Demasiados pedidos')
    // another IP is not affected
    const other = await call('/trpc/groups.preview', { headers: { 'x-forwarded-for': '198.51.100.99' } })
    expect(other.status).not.toBe(429)
  })
})
