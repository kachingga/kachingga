import { createClient } from '@supabase/supabase-js';

// The only file allowed to import Supabase (enforced by ESLint). Supabase is for auth only:
// data always goes through the API (tRPC).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  // Session persisted in localStorage and refreshed automatically by the library.
  { auth: { persistSession: true, autoRefreshToken: true } },
);
