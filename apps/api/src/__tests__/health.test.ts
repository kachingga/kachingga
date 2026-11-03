import { describe, expect, test } from 'bun:test'
import type { User } from '@supabase/supabase-js'
import { TRPCError } from '@trpc/server'
import { createCallerFactory } from '../trpc/init'
import { appRouter } from '../trpc/router'

const createCaller = createCallerFactory(appRouter)

describe('health router', () => {
  test('ping works without a user', async () => {
    const result = await createCaller({ user: null }).health.ping()
    expect(result.ok).toBe(true)
  })

  test('me rejects anonymous requests', async () => {
    const promise = createCaller({ user: null }).health.me()
    await expect(promise).rejects.toBeInstanceOf(TRPCError)
  })

  test('me returns the authenticated user', async () => {
    const user = { id: 'user-1', email: 'test@kachingga.com' } as User
    const result = await createCaller({ user }).health.me()
    expect(result).toEqual({ id: 'user-1', email: 'test@kachingga.com' })
  })
})
