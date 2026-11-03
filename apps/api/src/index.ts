import { Hono } from 'hono'
import { trpcServer } from '@hono/trpc-server'
import { appRouter } from './trpc/router'
import { createContext } from './trpc/context'

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true }))

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_opts, c) => createContext(c.req.raw),
  }),
)

export default {
  port: parseInt(process.env.PORT ?? '3000'),
  fetch: app.fetch,
}
