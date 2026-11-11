import { Hono, type Context as HonoContext } from 'hono'
import { trpcServer } from '@hono/trpc-server'
import { bodyLimit } from 'hono/body-limit'
import { getConnInfo } from 'hono/bun'
import { cors } from 'hono/cors'
import { appRouter } from './trpc/router'
import { initMonitoring, reportError, reportTrpcError } from './lib/monitoring'
import { clientIp, RATE_LIMIT_MESSAGE, RateLimiter } from './lib/rateLimit'
import { prisma } from './db'
import { createContext } from './trpc/context'

initMonitoring()

const app = new Hono()

// The web front runs in a browser on another origin, so the browser needs CORS. Native apps are not affected.
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173').split(',').map((o) => o.trim())
app.use(
  '/trpc/*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  }),
)

app.get('/health', (c) => c.json({ ok: true }))

// Health with a database round-trip, for the uptime monitor (UptimeRobot): `/health` only says the
// process is up, this one also catches the database down or paused (Supabase Free pauses a project
// after a week without activity; this ping every few minutes also counts as activity). Railway's
// healthcheck stays on `/health`, so a database problem doesn't block deploys.
const dbHealthLimiter = new RateLimiter()
app.get('/health/db', async (c) => {
  if (!dbHealthLimiter.allow(clientIp(c.req.raw, socketAddress(c)), '/health/db')) return c.json({ ok: false }, 429)
  try {
    await prisma.$queryRaw`SELECT 1`
    return c.json({ ok: true })
  } catch (error) {
    reportError(error)
    return c.json({ ok: false }, 503)
  }
})

// Per-IP limits (lib/rateLimit.ts) before anything else: a rejected request isn't read, parsed or
// authenticated (the token is validated with Supabase later, in createContext).
const ipLimiter = new RateLimiter()
app.use('/trpc/*', async (c, next) => {
  const ip = clientIp(c.req.raw, socketAddress(c))
  const paths = trpcPaths(c)
  // Count every call (not short-circuit), like tRPC would run them all.
  const allowed = paths.map((path) => ipLimiter.allow(ip, path))
  if (allowed.includes(false)) return trpcError(c, 'TOO_MANY_REQUESTS', RATE_LIMIT_MESSAGE)
  // Fail closed: only real procedures reach tRPC, so every call that runs was counted under its own
  // name. Anything else gets tRPC's answer to an unknown procedure, from here.
  if (!paths.every((path) => Object.hasOwn(appRouter._def.procedures, path))) return trpcError(c, 'NOT_FOUND', 'No encontrado')
  await next()
})

// No real request comes close (the biggest is an expense split among a whole group).
export const MAX_BODY_BYTES = 1024 * 1024
app.use(
  '/trpc/*',
  bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => trpcError(c, 'PAYLOAD_TOO_LARGE', 'El pedido es demasiado grande.') }),
)

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_opts, c) => createContext(c.req.raw, clientIp(c.req.raw, socketAddress(c))),
    onError: reportTrpcError,
  }),
)

// Anything that escapes Hono's handlers (not tRPC: tRPC answers its own errors).
app.onError((err, c) => {
  reportError(err)
  return c.json({ error: 'Error interno' }, 500)
})

// Procedures a tRPC request calls, read exactly like tRPC's fetch adapter does: one slash trimmed
// from each end (of the pathname, then of what follows `/trpc`), decoded, and split only when
// batched. `/trpc/a,b/?batch=1` → ['a', 'b']; `/trpc/groups%2Epreview/` → ['groups.preview'].
const trimSlashes = (path: string) => path.replace(/^\//, '').replace(/\/$/, '')
function trpcPaths(c: HonoContext) {
  const url = new URL(c.req.url)
  const path = trimSlashes(trimSlashes(url.pathname).slice('trpc'.length))
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return [path] // not a procedure: rejected as NOT_FOUND
  }
  return isBatch(c) ? decoded.split(',') : [decoded]
}
const isBatch = (c: HonoContext) => new URL(c.req.url).searchParams.get('batch') === '1'

// An error answered outside tRPC, in the same shape tRPC uses (superjson, one entry per call when
// batched), so the app reads it like any other API error and shows `message`.
const ERRORS = {
  NOT_FOUND: { rpcCode: -32004, httpStatus: 404 },
  TOO_MANY_REQUESTS: { rpcCode: -32029, httpStatus: 429 },
  PAYLOAD_TOO_LARGE: { rpcCode: -32013, httpStatus: 413 },
} as const
function trpcError(c: HonoContext, code: keyof typeof ERRORS, message: string) {
  const { rpcCode, httpStatus } = ERRORS[code]
  const error = (path: string) => ({ error: { json: { message, code: rpcCode, data: { code, httpStatus, path } } } })
  const paths = trpcPaths(c)
  return c.json(isBatch(c) ? paths.map(error) : error(paths[0]!), httpStatus)
}

// Socket address when running under Bun.serve; undefined when called without a server (tests).
function socketAddress(c: Parameters<typeof getConnInfo>[0]) {
  try {
    return getConnInfo(c).remote.address
  } catch {
    return undefined
  }
}

export default {
  port: parseInt(process.env.PORT ?? '3000'),
  fetch: app.fetch,
}
