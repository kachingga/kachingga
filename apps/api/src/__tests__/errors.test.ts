// What an error looks like over HTTP (errorFormatter in trpc/init.ts): the app shows `message` as is.
import { describe, expect, test } from 'bun:test'
import { TRPCError } from '@trpc/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { z } from 'zod'
import { publicProcedure, router } from '../trpc/init'

const testRouter = router({
  bug: publicProcedure.query(() => {
    throw new Error('connect ECONNREFUSED db.internal:5432 (user postgres)')
  }),
  prisma: publicProcedure.query(() => {
    throw Object.assign(new Error('Invalid `prisma.expense.findMany()` invocation: column "x" does not exist'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2022',
    })
  }),
  wrapped: publicProcedure.query(() => {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: new Error('relation "Secret" does not exist') })
  }),
  ours: publicProcedure.query(() => {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'No se pudo terminar. Intentá de nuevo.',
      cause: new Error('admin API 500'),
    })
  }),
  business: publicProcedure.query(() => {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'El grupo está archivado' })
  }),
  input: publicProcedure.input(z.object({ name: z.string().max(3, 'Nombre muy largo') })).query(() => 'ok'),
})

async function errorOf(path: string, input?: unknown) {
  const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
  const res = await fetchRequestHandler({
    endpoint: '/trpc',
    req: new Request(`http://test/trpc/${path}${query}`),
    router: testRouter,
    createContext: () => ({ user: null }),
  })
  const body = (await res.json()) as { error: { json: { message: string; data: { code: string } } } }
  return { status: res.status, code: body.error.json.data.code, message: body.error.json.message }
}

describe('error messages', () => {
  test('any unexpected error → a generic message in Spanish, never its text', async () => {
    for (const path of ['bug', 'prisma', 'wrapped']) {
      expect(await errorOf(path)).toEqual({ status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Error interno. Intentá de nuevo.' })
    }
  })

  test('business errors keep their message, and so does an INTERNAL we throw with our own', async () => {
    expect(await errorOf('business')).toEqual({ status: 400, code: 'BAD_REQUEST', message: 'El grupo está archivado' })
    expect(await errorOf('ours')).toEqual({ status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'No se pudo terminar. Intentá de nuevo.' })
  })

  test("invalid input → its first problem, not Zod's JSON", async () => {
    expect(await errorOf('input', { name: 'Larguísimo' })).toEqual({ status: 400, code: 'BAD_REQUEST', message: 'Nombre muy largo' })
  })
})
