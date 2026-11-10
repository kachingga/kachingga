import { describe, expect, test } from 'bun:test'
import { clientIp, GLOBAL_RULE, PROCEDURE_RULES, RateLimiter, USER_WRITE_RULES } from '../lib/rateLimit'

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

  test('the heavy reads have their own limit', () => {
    for (const path of ['balances.get', 'expenses.summary', 'expenses.export', 'categories.suggest']) {
      const limiter = new RateLimiter(clock().now)
      const { limit } = PROCEDURE_RULES[path]!
      expect(limit).toBeLessThan(GLOBAL_RULE.limit)
      for (let i = 0; i < limit; i++) expect(limiter.allow('1.1.1.1', path)).toBe(true)
      expect(limiter.allow('1.1.1.1', path)).toBe(false)
    }
  })

  test('writes per user: a burst limit per minute and a sustained one per hour', () => {
    const c = clock()
    const limiter = new RateLimiter(c.now)
    const [perMinute, perHour] = USER_WRITE_RULES
    for (let i = 0; i < perMinute!.limit; i++) expect(limiter.allowWrite('ana')).toBe(true)
    expect(limiter.allowWrite('ana')).toBe(false)
    expect(limiter.allowWrite('beto')).toBe(true) // per user
    // Spread over the hour, below the burst limit: the minute resets, the hour doesn't
    for (let allowed = 0; allowed < perHour!.limit; c.advance(perMinute!.windowMs)) {
      for (let i = 0; i < perMinute!.limit && allowed < perHour!.limit; i++, allowed++) expect(limiter.allowWrite('carla')).toBe(true)
    }
    expect(limiter.allowWrite('carla')).toBe(false)
    c.advance(perHour!.windowMs)
    expect(limiter.allowWrite('carla')).toBe(true)
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
  test('IPv6 is grouped by its /64 (one client can rotate addresses inside it)', () => {
    expect(clientIp(req('2001:db8:1:2:aaaa:bbbb:cccc:dddd'))).toBe('2001:db8:1:2::/64')
    expect(clientIp(req('2001:0db8:0001:0002::1'))).toBe('2001:db8:1:2::/64')
    expect(clientIp(req('2001:db8::1'))).toBe('2001:db8:0:0::/64')
    expect(clientIp(req(), '[2001:db8:1:2::9]')).toBe('2001:db8:1:2::/64')
    expect(clientIp(req(), 'fe80::1%en0')).toBe('fe80:0:0:0::/64')
    expect(clientIp(req('2001:db8:1:3::1'))).not.toBe(clientIp(req('2001:db8:1:2::1')))
  })
  test('IPv4-mapped IPv6 is the IPv4; anything unparseable stays as is', () => {
    expect(clientIp(req(), '::ffff:203.0.113.7')).toBe('203.0.113.7')
    expect(clientIp(req('no-es-una-ip'))).toBe('no-es-una-ip')
    expect(clientIp(req('zzzz::1'))).toBe('zzzz::1')
  })
})
