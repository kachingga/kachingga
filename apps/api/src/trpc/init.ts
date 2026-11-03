import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { RateLimiter } from '../lib/rateLimit'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({ transformer: superjson })

// Known Prisma errors → proper tRPC codes, in one place.
const prismaErrors = t.middleware(async ({ next }) => {
  const result = await next()
  if (!result.ok) {
    const prismaCode = (result.error.cause as { code?: unknown } | undefined)?.code
    if (prismaCode === 'P2002') throw new TRPCError({ code: 'CONFLICT', message: 'Ya existe', cause: result.error.cause })
    if (prismaCode === 'P2025') throw new TRPCError({ code: 'NOT_FOUND', message: 'No encontrado', cause: result.error.cause })
  }
  return result
})

const limiter = new RateLimiter()

// Per-IP limits (lib/rateLimit.ts). Runs before the auth check, so anonymous traffic is limited too.
const rateLimit = t.middleware(({ ctx, path, next }) => {
  if (ctx.ip && !limiter.allow(ctx.ip, path)) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Demasiados pedidos seguidos. Esperá un momento y probá de nuevo.' })
  }
  return next()
})

export const router = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure.use(rateLimit).use(prismaErrors)

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { user: ctx.user } })
})
