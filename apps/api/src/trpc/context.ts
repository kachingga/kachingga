import { isAuthRetryableFetchError, type User } from '@supabase/supabase-js'
import { signedInAt } from '../lib/session'
import { getSupabase } from '../lib/supabase'

// `ip` is set for real HTTP requests (rate limiting); callers built in tests may omit it.
// `authUnavailable`: the token couldn't be checked because Supabase Auth is down or unreachable.
// `signedInAt`: when this session was started with the password or Google (Unix seconds), if it was.
export type Context = { user: User | null; ip?: string; authUnavailable?: boolean; signedInAt?: number }

export async function createContext(req: Request, ip?: string): Promise<Context> {
  const header = req.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return { user: null, ip }

  const { data, error } = await getSupabase().auth.getUser(token)
  // Network error or a 5xx from Supabase: not an invalid token (protectedProcedure answers 503).
  if (error && isAuthRetryableFetchError(error)) return { user: null, ip, authUnavailable: true }
  if (error) return { user: null, ip }
  // Supabase just validated the token, so what it says can be read.
  return { user: data.user, ip, signedInAt: signedInAt(token) }
}
