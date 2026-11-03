import type { User } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'

export type Context = { user: User | null }

export async function createContext(req: Request): Promise<Context> {
  const header = req.headers.get('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return { user: null }

  const { data, error } = await getSupabase().auth.getUser(token)
  return { user: error ? null : data.user }
}
