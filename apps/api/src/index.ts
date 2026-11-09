import { Hono } from 'hono'
import { trpcServer } from '@hono/trpc-server'
import { getConnInfo } from 'hono/bun'
import { cors } from 'hono/cors'
import { appRouter } from './trpc/router'
import { initMonitoring, reportError, reportTrpcError } from './lib/monitoring'
import { clientIp, RateLimiter } from './lib/rateLimit'
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
