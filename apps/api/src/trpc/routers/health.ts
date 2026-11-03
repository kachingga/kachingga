import { publicProcedure, protectedProcedure, router } from '../init'

export const healthRouter = router({
  ping: publicProcedure.query(() => ({ ok: true, time: new Date() })),
  me: protectedProcedure.query(({ ctx }) => ({ id: ctx.user.id, email: ctx.user.email ?? null })),
})
