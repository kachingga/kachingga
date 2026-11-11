// In-memory, fixed-window rate limiting. Enough for a single API instance (Railway Hobby);
// with several instances it would need a shared store (e.g. Redis).
//
// Two kinds of limits:
// - Per IP (GLOBAL_RULE + PROCEDURE_RULES): checked in a Hono middleware before the tRPC handler
//   (index.ts), so a rejected request never reaches Supabase to validate its token.
// - Per user (USER_PROCEDURE_RULES, USER_WRITE_RULES, USER_CREATION_RULE): checked after login
//   (protectedProcedure in trpc/init.ts).

export type Rule = { limit: number; windowMs: number }

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// Every tRPC call from one IP counts here (a batched request counts once per procedure).
export const GLOBAL_RULE: Rule = { limit: 300, windowMs: MINUTE }

// Stricter limits per IP on top of the global one.
export const PROCEDURE_RULES: Record<string, Rule> = {
  // Invite codes: slow down anyone trying to guess them
  'groups.preview': { limit: 20, windowMs: 10 * MINUTE },
  'groups.join': { limit: 20, windowMs: 10 * MINUTE },
  // Heavy: reads every matching expense of a group
  'expenses.export': { limit: 20, windowMs: MINUTE },
  'expenses.summary': { limit: 60, windowMs: MINUTE },
  'balances.get': { limit: 60, windowMs: MINUTE },
  // Asked while typing (debounced): reads the group's latest expenses on every call
  'categories.suggest': { limit: 60, windowMs: MINUTE },
  // Calls Supabase's admin API; a person needs it once (maybe a retry)
  'profile.deleteAccount': { limit: 5, windowMs: 10 * MINUTE },
}

// The same per user, on top of the per-IP ones: an account doesn't get more by switching networks.
export const USER_PROCEDURE_RULES: Record<string, Rule> = {
  'groups.preview': { limit: 20, windowMs: 10 * MINUTE },
  'groups.join': { limit: 20, windowMs: 10 * MINUTE },
}

// Writes per user (any mutation): far above what a person does by hand, and they bound how fast
// one account can fill the database.
export const USER_WRITE_RULES: Rule[] = [
  { limit: 30, windowMs: MINUTE },
  { limit: 300, windowMs: HOUR },
]

// Mutations that create rows (every join counts, also claiming someone). Between all of them, one
// user creates at most USER_CREATION_RULE per day; the database size guard (lib/dbSize.ts) also
// applies to them. A new mutation that creates rows goes here.
export const CREATING_PROCEDURES: ReadonlySet<string> = new Set([
  'groups.create',
  'groups.join',
  'participants.add',
  'categories.create',
  'expenses.create',
  'settlements.create',
  'savedFilters.create',
])
export const USER_CREATION_RULE: Rule = { limit: 200, windowMs: DAY }

export const RATE_LIMIT_MESSAGE = 'Demasiados pedidos seguidos. Esperá un momento y probá de nuevo.'
export const CREATION_LIMIT_MESSAGE = 'Llegaste al máximo de cosas nuevas por hoy. Probá de nuevo mañana.'

// Rules are looked up by a path that comes from the request: only their own keys (not `constructor`…).
const ruleFor = (rules: Record<string, Rule>, path: string) => (Object.hasOwn(rules, path) ? rules[path] : undefined)

export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>()
  private now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  private hit(key: string, rule: Rule) {
    const now = this.now()
    if (this.hits.size > 50_000) this.prune(now)
    const entry = this.hits.get(key)
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + rule.windowMs })
      return true
    }
    entry.count += 1
    return entry.count <= rule.limit
  }

  private prune(now: number) {
    for (const [key, entry] of this.hits) if (entry.resetAt <= now) this.hits.delete(key)
  }

  /** Counts one call to `path` from `ip`; false if it goes over the global or the procedure limit. */
  allow(ip: string, path: string) {
    const globalOk = this.hit(ip, GLOBAL_RULE)
    const rule = ruleFor(PROCEDURE_RULES, path)
    const procedureOk = rule ? this.hit(`${ip}:${path}`, rule) : true
    return globalOk && procedureOk
  }

  /** Counts one call to `path` by `userId`; false if it goes over its USER_PROCEDURE_RULES limit. */
  allowCall(userId: string, path: string) {
    const rule = ruleFor(USER_PROCEDURE_RULES, path)
    return rule ? this.hit(`user:${userId}:${path}`, rule) : true
  }

  /** Counts one write by `userId`; false if it goes over any of USER_WRITE_RULES. */
  allowWrite(userId: string) {
    const results = USER_WRITE_RULES.map((rule) => this.hit(`user:${userId}:${rule.windowMs}`, rule))
    return results.every(Boolean)
  }

  /** Counts one creation (CREATING_PROCEDURES) by `userId`; false if it goes over USER_CREATION_RULE. */
  allowCreation(userId: string) {
    return this.hit(`user:${userId}:creations`, USER_CREATION_RULE)
  }
}

/**
 * Client IP. Behind Railway's proxy the client is the LAST entry of X-Forwarded-For (the one the
 * proxy added; earlier entries can be forged by the client). Without the header, the socket address.
 * IPv6 addresses are grouped by their /64 prefix: a single client usually gets a whole /64 and
 * could otherwise rotate addresses to dodge the limits.
 */
export function clientIp(req: Request, socketAddress?: string) {
  const forwarded = req.headers.get('x-forwarded-for')
  const last = forwarded?.split(',').at(-1)?.trim()
  const ip = last || socketAddress
  return ip ? ipv6Prefix(ip) : 'unknown'
}

// IPv6 → its /64 prefix ("2001:db8:1:2::/64"); IPv4 (also IPv4-mapped IPv6) and anything else as is.
function ipv6Prefix(ip: string) {
  const address = ip.replace(/^\[|\]$/g, '').split('%')[0]!
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped) return mapped[1]!
  if (!address.includes(':')) return ip
  const [head = '', tail] = address.split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(8 - left.length - right.length, 0)).fill('0'), ...right]
  const prefix = groups.slice(0, 4).map((g) => parseInt(g, 16))
  if (prefix.length < 4 || prefix.some((g) => !(g >= 0 && g <= 0xffff))) return ip
  return `${prefix.map((g) => g.toString(16)).join(':')}::/64`
}
