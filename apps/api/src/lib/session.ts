// Ways of signing in that prove who you are at that moment (`amr` methods of Supabase Auth): typing
// the password and Google. Not the links of the mails (`otp`, `recovery`, `email_change`…).
const SIGN_IN_METHODS = new Set(['password', 'oauth'])

/**
 * When this session was started by typing the password or with Google (Unix seconds), from the
 * Supabase token's `amr` claim: one entry per method used to start the session, with when. Refreshing
 * the token keeps it as it was, so an old session stays old. Undefined if neither method is there or
 * the token can't be read.
 *
 * It doesn't check the signature: call it only with a token Supabase already validated (`getUser`).
 */
export function signedInAt(token: string): number | undefined {
  try {
    const base64 = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const { amr } = JSON.parse(new TextDecoder().decode(bytes)) as { amr?: unknown }
    if (!Array.isArray(amr)) return undefined
    const times = (amr as { method?: unknown; timestamp?: unknown }[])
      .filter((entry) => SIGN_IN_METHODS.has(entry?.method as string) && Number.isFinite(entry?.timestamp))
      .map((entry) => entry.timestamp as number)
    return times.length > 0 ? Math.max(...times) : undefined
  } catch {
    return undefined
  }
}

/** Signed in (password or Google) at most this long ago: see `profile.deleteAccount`. */
export const RECENT_SIGN_IN_SECONDS = 5 * 60

export function signedInRecently(at: number | undefined, now = Date.now()) {
  return at !== undefined && now / 1000 - at <= RECENT_SIGN_IN_SECONDS
}
