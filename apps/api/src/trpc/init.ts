import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { RATE_LIMIT_MESSAGE, RateLimiter } from '../lib/rateLimit'
import type { Context } from './context'

const INTERNAL_MESSAGE = 'Error interno. Intentá de nuevo.'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  // The app shows `message` as it comes, so: never the text of an unexpected error (Prisma, a bug…),
  // and for an invalid input its first problem (our messages in Spanish) instead of Zod's JSON.
  errorFormatter({ shape, error }) {
    if (error.code === 'INTERNAL_SERVER_ERROR') return { ...shape, message: INTERNAL_MESSAGE }
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

export const protectedProcedure = publicProcedure.use(({ ctx, type, next }) => {
  if (!ctx.user) {
    // Supabase Auth didn't answer: the session may be fine, so it's not UNAUTHORIZED.
    if (ctx.authUnavailable) {
      throw new TRPCError({ code: 'SERVICE_UNAVAILABLE', message: 'No pudimos verificar tu sesión. Probá de nuevo en un rato.' })
    }
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  // Only real HTTP requests (ctx.ip set) are limited; callers built in tests aren't.
  if (type === 'mutation' && ctx.ip && !limiter.allowWrite(ctx.user.id)) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: RATE_LIMIT_MESSAGE })
  }
  return next({ ctx: { user: ctx.user } })
})
