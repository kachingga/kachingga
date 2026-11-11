// HTTP wiring: Hono + tRPC adapter + superjson, through the real server's fetch handler (no network).
import { describe, expect, mock, test } from 'bun:test'
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import superjson from 'superjson'
import { GLOBAL_RULE } from '../lib/rateLimit'

// Fake Supabase Auth: "valid" is a good token, "down" is Supabase unreachable, anything else is invalid.
const getUser = mock(async (token: string) => {
  if (token === 'valid') return { data: { user: { id: 'user-http' } }, error: null }
  if (token === 'down') return { data: { user: null }, error: new AuthRetryableFetchError('fetch failed', 0) }
  return { data: { user: null }, error: new AuthApiError('invalid JWT', 401, 'bad_jwt') }
})
mock.module('../lib/supabase', () => ({ getSupabase: () => ({ auth: { getUser } }) }))

const { default: server, MAX_BODY_BYTES } = await import('../index')

const call = (path: string, init?: RequestInit) => server.fetch(new Request(`http://test${path}`, init))
type ErrorBody = { error: { json: { message: string; code: number; data: { code: string; httpStatus: number; path: string } } } }

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

  test('rate limit runs before the token is validated: a 429 never calls Supabase', async () => {
    const me = () => call('/trpc/health.me', { headers: { Authorization: 'Bearer valid', 'x-forwarded-for': '198.51.100.30' } })
    for (let i = 0; i < GLOBAL_RULE.limit; i++) expect((await me()).status).toBe(200)
    getUser.mockClear()
    expect((await me()).status).toBe(429)
    expect(getUser).not.toHaveBeenCalled()
  })

  test('the 429 has the same shape as any tRPC error, one per call when batched', async () => {
    const ip = { 'x-forwarded-for': '198.51.100.31' }
    const ownError = (await (await call('/trpc/groups.list', { headers: ip })).json()) as ErrorBody // tRPC's 401
    for (let i = 0; i < 20; i++) await call('/trpc/groups.preview', { headers: ip })

    const res = await call('/trpc/health.ping,groups.preview?batch=1', { headers: ip })
    expect(res.status).toBe(429)
    const body = (await res.json()) as ErrorBody[]
    expect(body.map((e) => e.error.json.data)).toEqual([
      { code: 'TOO_MANY_REQUESTS', httpStatus: 429, path: 'health.ping' },
      { code: 'TOO_MANY_REQUESTS', httpStatus: 429, path: 'groups.preview' },
    ])
    const [first] = body
    expect(Object.keys(first!.error.json).sort()).toEqual(Object.keys(ownError.error.json).sort())
    const { stack: _stack, ...ownData } = ownError.error.json.data as ErrorBody['error']['json']['data'] & { stack?: string }
    expect(Object.keys(first!.error.json.data).sort()).toEqual(Object.keys(ownData).sort())
    expect(first!.error.json.message).toContain('Demasiados pedidos')
  })

  test('a URL-encoded path counts like the plain one (no dodging the invite-code limit)', async () => {
    const ip = { 'x-forwarded-for': '198.51.100.32' }
    for (let i = 0; i < 20; i++) await call('/trpc/groups%2Epreview', { headers: ip })
    expect((await call('/trpc/groups.preview', { headers: ip })).status).toBe(429)
  })

  test('a trailing slash counts like the plain path, also at the end of a batch', async () => {
    const ip = { 'x-forwarded-for': '198.51.100.34' }
    // tRPC runs them as groups.preview (401 without login, not 404)...
    for (let i = 0; i < 10; i++) expect((await call('/trpc/groups.preview/', { headers: ip })).status).toBe(401)
    for (let i = 0; i < 10; i++) {
      const res = await call('/trpc/health.ping,groups.preview/?batch=1', { headers: ip })
      const body = (await res.json()) as unknown[]
      expect(body).toHaveLength(2)
      expect(res.status).not.toBe(429)
    }
    // ...so they count as groups.preview
    expect((await call('/trpc/groups.preview', { headers: ip })).status).toBe(429)
    expect((await call('/trpc/groups.preview/', { headers: ip })).status).toBe(429)
    expect((await call('/trpc/health.ping,groups.preview/?batch=1', { headers: ip })).status).toBe(429)
  })

  test('fail closed: a path that is not a procedure is answered as NOT_FOUND before tRPC (Supabase is never called)', async () => {
    const headers = { Authorization: 'Bearer valid', 'x-forwarded-for': '198.51.100.35' }
    getUser.mockClear()
    const paths = [
      '/trpc/nope.nada',
      '/trpc/constructor',
      '/trpc/__proto__',
      '/trpc/groups.preview%2F',
      '/trpc//groups.preview',
      '/trpc/groups.preview,groups.join', // not batched: one path with a comma
      '/trpc/%E0%A4%A',
      '/trpc',
    ]
    for (const path of paths) {
      const res = await call(path, { headers })
      expect(res.status).toBe(404)
      expect(((await res.json()) as ErrorBody).error.json.data.code).toBe('NOT_FOUND')
    }
    // Batched: the whole request, one error per call
    const res = await call('/trpc/health.ping,nope.nada?batch=1', { headers })
    expect(res.status).toBe(404)
    expect(((await res.json()) as ErrorBody[]).map((e) => e.error.json.data)).toEqual([
      { code: 'NOT_FOUND', httpStatus: 404, path: 'health.ping' },
      { code: 'NOT_FOUND', httpStatus: 404, path: 'nope.nada' },
    ])
    expect(getUser).not.toHaveBeenCalled()
  })

  test('unknown paths still count toward the per-IP limit', async () => {
    const ip = { 'x-forwarded-for': '198.51.100.36' }
    for (let i = 0; i < GLOBAL_RULE.limit; i++) expect((await call('/trpc/nope.nada', { headers: ip })).status).toBe(404)
    expect((await call('/trpc/nope.nada', { headers: ip })).status).toBe(429)
    expect((await call('/trpc/health.ping', { headers: ip })).status).toBe(429)
  })

  test('a body over 1 MB → 413 PAYLOAD_TOO_LARGE before tRPC reads it', async () => {
    const post = (body: BodyInit, headers: Record<string, string> = {}) =>
      call('/trpc/groups.create', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.33', ...headers },
        body,
      })
    const res = await post('x'.repeat(MAX_BODY_BYTES + 1))
    expect(res.status).toBe(413)
    const body = (await res.json()) as ErrorBody
    expect(body.error.json.data.code).toBe('PAYLOAD_TOO_LARGE')
    expect(body.error.json.message).toBe('El pedido es demasiado grande.')
    // Below the limit it reaches tRPC (here: no login)
    expect((await post(JSON.stringify({ json: { name: 'Viaje' } }))).status).toBe(401)
  })
})

describe('auth', () => {
  const me = (token: string) =>
    call('/trpc/health.me', { headers: { Authorization: `Bearer ${token}`, 'x-forwarded-for': '198.51.100.40' } })

  test('valid token → the user; invalid token → 401 UNAUTHORIZED', async () => {
    expect((await me('valid')).status).toBe(200)
    const res = await me('fake')
    expect(res.status).toBe(401)
    expect(((await res.json()) as ErrorBody).error.json.data.code).toBe('UNAUTHORIZED')
  })

  test('when the session was signed in with the password or Google (`amr`) is read only from a token Supabase validated', async () => {
    const { createContext } = await import('../trpc/context')
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const jwt = `${part({ alg: 'ES256' })}.${part({ sub: 'user-http', amr: [{ method: 'password', timestamp: 1794300000 }] })}.firma`
    const withToken = () => new Request('http://test/trpc/health.me', { headers: { Authorization: `Bearer ${jwt}` } })

    getUser.mockImplementationOnce(async () => ({ data: { user: { id: 'user-http' } }, error: null }))
    expect(await createContext(withToken())).toMatchObject({ user: { id: 'user-http' }, signedInAt: 1794300000 })

    // Rejected by Supabase (the default fake rejects it): nothing is read from it
    const rejected = await createContext(withToken())
    expect(rejected.user).toBeNull()
    expect(rejected.signedInAt).toBeUndefined()
  })

  test('Supabase Auth down → 503 SERVICE_UNAVAILABLE, not UNAUTHORIZED (the session may be fine)', async () => {
    const res = await me('down')
    expect(res.status).toBe(503)
    const body = (await res.json()) as ErrorBody
    expect(body.error.json.data.code).toBe('SERVICE_UNAVAILABLE')
    expect(body.error.json.message).toBe('No pudimos verificar tu sesión. Probá de nuevo en un rato.')
    // Public procedures still answer
    const ping = await call('/trpc/health.ping', { headers: { Authorization: 'Bearer down', 'x-forwarded-for': '198.51.100.40' } })
    expect(ping.status).toBe(200)
  })
})
