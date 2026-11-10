// In-memory, fixed-window rate limiting per IP. Enough for a single API instance (Railway Hobby);
// with several instances it would need a shared store (e.g. Redis).

export type Rule = { limit: number; windowMs: number }

const MINUTE = 60_000

// Every tRPC call from one IP counts here (a batched request counts once per procedure).
export const GLOBAL_RULE: Rule = { limit: 300, windowMs: MINUTE }

// Stricter limits on top of the global one.
export const PROCEDURE_RULES: Record<string, Rule> = {
  // Invite codes: slow down anyone trying to guess them
  'groups.preview': { limit: 20, windowMs: 10 * MINUTE },
  'groups.join': { limit: 20, windowMs: 10 * MINUTE },
  // Heavy: reads every matching expense of a group
  'expenses.export': { limit: 20, windowMs: MINUTE },
  // Asked while typing (debounced): reads the group's latest expenses on every call
  'categories.suggest': { limit: 60, windowMs: MINUTE },
  // Calls Supabase's admin API; a person needs it once (maybe a retry)
  'profile.deleteAccount': { limit: 5, windowMs: 10 * MINUTE },
}

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
    const rule = PROCEDURE_RULES[path]
    const procedureOk = rule ? this.hit(`${ip}:${path}`, rule) : true
    return globalOk && procedureOk
  }
}

/**
 * Client IP. Behind Railway's proxy the client is the LAST entry of X-Forwarded-For (the one the
 * proxy added; earlier entries can be forged by the client). Without the header, the socket address.
 */
export function clientIp(req: Request, socketAddress?: string) {
  const forwarded = req.headers.get('x-forwarded-for')
  const last = forwarded?.split(',').at(-1)?.trim()
  return last || socketAddress || 'unknown'
}
