import { describe, expect, test } from 'bun:test'
import {
  clientIp,
  ConcurrencyLimiter,
  CREATING_PROCEDURES,
  GLOBAL_RULE,
  HEAVY_READS,
  HEAVY_READS_FULL_REPORT_EVERY_MS,
  MAX_KEYS,
  PROCEDURE_RULES,
  PRUNE_INTERVAL_MS,
  RateLimiter,
  USER_CREATION_RULE,
  USER_PROCEDURE_RULES,
  USER_WRITE_RULES,
} from '../lib/rateLimit'
import { appRouter } from '../trpc/router'

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

  test('invite codes per user too, each procedure on its own', () => {
    const limiter = new RateLimiter(clock().now)
    const { limit } = USER_PROCEDURE_RULES['groups.preview']!
    for (let i = 0; i < limit; i++) expect(limiter.allowCall('ana', 'groups.preview')).toBe(true)
    expect(limiter.allowCall('ana', 'groups.preview')).toBe(false)
    expect(limiter.allowCall('ana', 'groups.join')).toBe(true)
    expect(limiter.allowCall('beto', 'groups.preview')).toBe(true)
    for (let i = 0; i < 100; i++) expect(limiter.allowCall('ana', 'groups.list')).toBe(true) // no per-user rule
  })

  test('creations per user and day, between all the creating procedures', () => {
    const c = clock()
    const limiter = new RateLimiter(c.now)
    for (let i = 0; i < USER_CREATION_RULE.limit; i++) expect(limiter.allowCreation('ana')).toBe(true)
    expect(limiter.allowCreation('ana')).toBe(false)
    expect(limiter.allowCreation('beto')).toBe(true)
    c.advance(USER_CREATION_RULE.windowMs - 1)
    expect(limiter.allowCreation('ana')).toBe(false)
    c.advance(1)
    expect(limiter.allowCreation('ana')).toBe(true)
  })

  test('expired keys are swept, but at most every PRUNE_INTERVAL_MS (a sweep walks the whole map)', () => {
    const c = clock()
    const limiter = new RateLimiter(c.now)
    limiter.allow('1.1.1.1', 'groups.get')
    c.advance(GLOBAL_RULE.windowMs)
    limiter.allow('2.2.2.2', 'groups.get') // sweeps: 1.1.1.1 expired
    expect(limiter.size).toBe(1)
    c.advance(GLOBAL_RULE.windowMs - PRUNE_INTERVAL_MS / 2)
    limiter.allow('3.3.3.3', 'groups.get') // sweeps, nothing expired yet
    c.advance(PRUNE_INTERVAL_MS / 2)
    limiter.allow('4.4.4.4', 'groups.get') // 2.2.2.2 just expired, but the last sweep was too recent
    expect(limiter.size).toBe(3)
    c.advance(PRUNE_INTERVAL_MS / 2)
    limiter.allow('5.5.5.5', 'groups.get') // sweeps again
    expect(limiter.size).toBe(3)
  })

  test('holds at most maxKeys: full of live keys, the oldest ones go and start counting again', () => {
    const limiter = new RateLimiter(clock().now, 10)
    for (let i = 0; i < GLOBAL_RULE.limit; i++) limiter.allow('0.0.0.0', 'groups.get')
    expect(limiter.allow('0.0.0.0', 'groups.get')).toBe(false)
    for (let i = 1; i <= 100; i++) {
      limiter.allow(`10.0.0.${i}`, 'groups.get')
      expect(limiter.size).toBeLessThanOrEqual(10)
    }
    expect(limiter.allow('0.0.0.0', 'groups.get')).toBe(true)
  })

  test('stays fast with the map full (before, every call walked it)', () => {
    const limiter = new RateLimiter(clock().now)
    const start = performance.now()
    for (let i = 0; i < 4 * MAX_KEYS; i++) limiter.allow(`ip-${i}`, 'groups.get')
    expect(limiter.size).toBeLessThanOrEqual(MAX_KEYS)
    expect(performance.now() - start).toBeLessThan(2000) // ~100 ms; walking the map on every call took minutes
  })

  test('a path that names an inherited property (constructor…) is not a rule: it only counts toward the global limit', () => {
    const limiter = new RateLimiter(clock().now)
    for (const path of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      for (let i = 0; i < 10; i++) {
        expect(limiter.allow('1.1.1.1', path)).toBe(true)
        expect(limiter.allowCall('ana', path)).toBe(true)
      }
    }
  })

  test('every rule and every creating procedure names a real procedure (a typo would leave it unlimited)', () => {
    // Typed like the nested router, but at runtime it's flat: { 'groups.preview': procedure, … }
    const procedures = appRouter._def.procedures as unknown as Record<string, { _def: { type: string } }>
    for (const path of [...Object.keys(PROCEDURE_RULES), ...Object.keys(USER_PROCEDURE_RULES)]) {
      expect(Object.hasOwn(procedures, path)).toBe(true)
    }
    for (const path of CREATING_PROCEDURES) expect(procedures[path]?._def.type).toBe('mutation')
    for (const path of HEAVY_READS) expect(procedures[path]?._def.type).toBe('query')
  })

  test('every heavy read has its limit per IP and per user', () => {
    for (const path of HEAVY_READS) {
      expect(PROCEDURE_RULES[path]).toBeDefined()
      expect(USER_PROCEDURE_RULES[path]).toEqual(PROCEDURE_RULES[path]!)
    }
  })
})

describe('ConcurrencyLimiter', () => {
  test('at most perUser at a time for each user, and max in total', () => {
    const limiter = new ConcurrencyLimiter(2, 3)
    const ana1 = limiter.acquire('ana')!
    expect(limiter.acquire('ana')).not.toBeNull()
    expect(limiter.acquire('ana')).toBeNull() // her 2 are taken
    expect(limiter.acquire('beto')).not.toBeNull()
    expect(limiter.acquire('carla')).toBeNull() // the 3 are taken
    ana1()
    expect(limiter.acquire('carla')).not.toBeNull() // the one she gave back
    expect(limiter.acquire('dani')).toBeNull()
  })

  test('every slot taken → reported to Sentry, at most once every HEAVY_READS_FULL_REPORT_EVERY_MS', () => {
    const c = clock()
    const reports: Error[] = []
    const limiter = new ConcurrencyLimiter(1, 2, { report: (e) => reports.push(e), now: c.now })
    limiter.acquire('ana')
    expect(limiter.acquire('ana')).toBeNull() // only her slots: normal use, not reported
    expect(reports).toHaveLength(0)
    limiter.acquire('beto')
    expect(limiter.acquire('carla')).toBeNull()
    expect(limiter.acquire('dani')).toBeNull()
    expect(reports.map((e) => e.message)).toEqual(['All 2 heavy read slots are taken: rejecting heavy reads (HEAVY_READS_TOTAL)'])
    c.advance(HEAVY_READS_FULL_REPORT_EVERY_MS - 1)
    limiter.acquire('carla')
    expect(reports).toHaveLength(1)
    c.advance(1)
    limiter.acquire('carla')
    expect(reports).toHaveLength(2)
  })

  test('giving a slot back twice frees it only once', () => {
    const limiter = new ConcurrencyLimiter(1, 2)
    const release = limiter.acquire('ana')!
    expect(limiter.acquire('beto')).not.toBeNull()
    release()
    release()
    expect(limiter.acquire('ana')).not.toBeNull()
    expect(limiter.acquire('carla')).toBeNull() // still 2 running: ana's new one and beto's
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
