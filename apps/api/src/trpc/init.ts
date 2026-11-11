import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { assertDatabaseHasRoom } from '../lib/dbSize'
import { CREATING_PROCEDURES, CREATION_LIMIT_MESSAGE, RATE_LIMIT_MESSAGE, RateLimiter } from '../lib/rateLimit'
import type { Context } from './context'

const INTERNAL_MESSAGE = 'Error interno. Intentá de nuevo.'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  // The app shows `message` as it comes, so: never the text of an unexpected error (Prisma, a bug…),
  // and for an invalid input its first problem (our messages in Spanish) instead of Zod's JSON.
  // tRPC wraps anything that isn't a TRPCError as INTERNAL_SERVER_ERROR with the original text as
  // its message: that's what gets replaced. An INTERNAL we throw with our own message keeps it.
  errorFormatter({ shape, error }) {
    const internalText = error.message === (error.cause as Error | undefined)?.message || error.message === error.code
    if (error.code === 'INTERNAL_SERVER_ERROR' && internalText) return { ...shape, message: INTERNAL_MESSAGE }
    if (error.cause instanceof ZodError) return { ...shape, message: error.cause.issues[0]?.message ?? shape.message }
    return shape
  },
})

// Known Prisma errors → proper tRPC codes, in one place. Any other error ends up as
// INTERNAL_SERVER_ERROR, whose message the errorFormatter replaces.
const prismaErrors = t.middleware(async ({ next }) => {
  const result = await next()
  if (!result.ok) {
    const cause = result.error.cause as { code?: unknown } | undefined
    const prismaCode = cause?.code
    if (prismaCode === 'P2002') throw new TRPCError({ code: 'CONFLICT', message: 'Ya existe', cause: result.error.cause })
    if (prismaCode === 'P2025') throw new TRPCError({ code: 'NOT_FOUND', message: 'No encontrado', cause: result.error.cause })
  }
  return result
})

// Per-IP limits run before tRPC (index.ts); here only the per-user ones, which need the login.
const limiter = new RateLimiter()

export const router = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure.use(prismaErrors)

const tooManyRequests = (message: string) => new TRPCError({ code: 'TOO_MANY_REQUESTS', message })

export const protectedProcedure = publicProcedure.use(async ({ ctx, type, path, next }) => {
  if (!ctx.user) {
    // Supabase Auth didn't answer: the session may be fine, so it's not UNAUTHORIZED.
    if (ctx.authUnavailable) {
      throw new TRPCError({ code: 'SERVICE_UNAVAILABLE', message: 'No pudimos verificar tu sesión. Probá de nuevo en un rato.' })
    }
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  const creates = CREATING_PROCEDURES.has(path)
  // Only real HTTP requests (ctx.ip set) are limited; callers built in tests (and the seed) aren't.
  if (ctx.ip) {
    if (type === 'mutation' && !limiter.allowWrite(ctx.user.id)) throw tooManyRequests(RATE_LIMIT_MESSAGE)
    if (!limiter.allowCall(ctx.user.id, path)) throw tooManyRequests(RATE_LIMIT_MESSAGE)
    if (creates && !limiter.allowCreation(ctx.user.id)) throw tooManyRequests(CREATION_LIMIT_MESSAGE)
  }
  if (creates) await assertDatabaseHasRoom()
  return next({ ctx: { user: ctx.user } })
})
