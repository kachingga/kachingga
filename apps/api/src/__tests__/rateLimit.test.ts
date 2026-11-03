import { describe, expect, test } from 'bun:test'
import { clientIp, GLOBAL_RULE, PROCEDURE_RULES, RateLimiter } from '../lib/rateLimit'

function clock() {
  let now = 0
  return { now: () => now, advance: (ms: number) => (now += ms) }
}

describe('RateLimiter', () => {
  test('global limit per IP, resets after the window', () => {
    const c = clock()
    const limiter = new RateLimiter(c.now)
    for (let i = 0; i < GLOBAL_RULE.limit; i++) expect(limiter.allow('1.1.1.1', 'groups.get')).toBe(true)
    expect(limiter.allow('1.1.1.1', 'groups.get')).toBe(false)
    expect(limiter.allow('2.2.2.2', 'groups.get')).toBe(true) // other IPs are independent
    c.advance(GLOBAL_RULE.windowMs)
    expect(limiter.allow('1.1.1.1', 'groups.get')).toBe(true)
  })

  test('stricter limit for invite codes, independent per procedure', () => {
    const limiter = new RateLimiter(clock().now)
    const { limit } = PROCEDURE_RULES['groups.preview']!
    for (let i = 0; i < limit; i++) expect(limiter.allow('1.1.1.1', 'groups.preview')).toBe(true)
    expect(limiter.allow('1.1.1.1', 'groups.preview')).toBe(false)
    expect(limiter.allow('1.1.1.1', 'groups.get')).toBe(true) // other procedures still work
  })
})

describe('clientIp', () => {
  const req = (xff?: string) => new Request('http://x', { headers: xff ? { 'x-forwarded-for': xff } : {} })
  test('last X-Forwarded-For entry (the one the proxy added; earlier ones can be forged)', () => {
    expect(clientIp(req('6.6.6.6, 203.0.113.7'))).toBe('203.0.113.7')
    expect(clientIp(req('203.0.113.7'))).toBe('203.0.113.7')
  })
  test('falls back to the socket address, then "unknown"', () => {
    expect(clientIp(req(), '10.0.0.1')).toBe('10.0.0.1')
    expect(clientIp(req())).toBe('unknown')
  })
})
