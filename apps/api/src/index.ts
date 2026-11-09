import { Hono } from 'hono'
import { trpcServer } from '@hono/trpc-server'
import { getConnInfo } from 'hono/bun'
import { cors } from 'hono/cors'
import { appRouter } from './trpc/router'
import { initMonitoring, reportError, reportTrpcError } from './lib/monitoring'
import { clientIp } from './lib/rateLimit'
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
