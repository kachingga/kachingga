import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ErrorEvent } from '@sentry/bun'
import { TRPCError } from '@trpc/server'

const init = mock(() => {})
const captureException = mock(() => {})
mock.module('@sentry/bun', () => ({
  init,
  captureException,
  withScope: (fn: (scope: { setTag: () => void }) => void) => fn({ setTag: () => {} }),
}))

const { initMonitoring, reportError, reportTrpcError, scrubEvent } = await import('../lib/monitoring')

describe('monitoring', () => {
  beforeEach(() => {
    init.mockClear()
    captureException.mockClear()
  })

  it('does nothing without SENTRY_DSN', () => {
    expect(initMonitoring({})).toBe(false)
    expect(init).not.toHaveBeenCalled()
    expect(reportError(new Error('x'))).toBe(false)
    expect(captureException).not.toHaveBeenCalled()
  })

  it('reports only internal errors, never business errors', () => {
    expect(initMonitoring({ SENTRY_DSN: 'https://key@sentry.example/1', SENTRY_ENVIRONMENT: 'staging' })).toBe(true)
    expect(init).toHaveBeenCalled()

    for (const code of ['NOT_FOUND', 'BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'CONFLICT', 'TOO_MANY_REQUESTS'] as const) {
      expect(reportTrpcError({ error: new TRPCError({ code }), path: 'groups.get' })).toBe(false)
    }
    expect(captureException).not.toHaveBeenCalled()

    const cause = new Error('db down')
    expect(reportTrpcError({ error: new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause }), path: 'groups.get' })).toBe(true)
    expect(captureException).toHaveBeenCalledWith(cause)
  })

  it('never sends the token, the body, the query or the IP', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: 'https://api.kachingga.com/trpc/expenses.list?input=%7B%22amountCents%22%3A1000%7D',
        query_string: 'input=...',
        data: '{"paymentAlias":"galo.mp"}',
        headers: { Authorization: 'Bearer secret' },
        cookies: { a: 'b' },
      },
      user: { id: 'user-1', email: 'galo@example.com', ip_address: '1.2.3.4' },
    } as ErrorEvent)
    expect(event.request).toEqual({ url: 'https://api.kachingga.com/trpc/expenses.list' })
    expect(event.user).toEqual({ id: 'user-1' })
  })
})
