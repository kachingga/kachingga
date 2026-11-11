// When the session was signed in with the password or Google, from the token's `amr` (lib/session.ts).
import { describe, expect, test } from 'bun:test'
import { RECENT_SIGN_IN_SECONDS, signedInAt, signedInRecently } from '../lib/session'

// A Supabase-shaped access token (header.payload.signature, base64url); the signature isn't read.
function fakeToken(payload: object) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({ alg: 'ES256', typ: 'JWT' })}.${part(payload)}.firma`
}

describe('signedInAt', () => {
  test('the moment of the password or Google sign-in', () => {
    expect(signedInAt(fakeToken({ amr: [{ method: 'password', timestamp: 1794300000 }] }))).toBe(1794300000)
    expect(signedInAt(fakeToken({ amr: [{ method: 'oauth', timestamp: 1794300001 }] }))).toBe(1794300001)
  })

  test('with several methods, the latest password or Google one', () => {
    const amr = [
      { method: 'otp', timestamp: 1794300900 },
      { method: 'oauth', timestamp: 1794300500 },
      { method: 'password', timestamp: 1794300100 },
    ]
    expect(signedInAt(fakeToken({ amr }))).toBe(1794300500)
  })

  test('the links of the mails and refreshing the token are not signing in again', () => {
    const amr = ['otp', 'recovery', 'email_change', 'email/signup', 'magiclink', 'token_refresh'].map((method) => ({
      method,
      timestamp: 1794300000,
    }))
    expect(signedInAt(fakeToken({ amr }))).toBeUndefined()
  })

  test('reads tokens with accents and emojis in the metadata (UTF-8)', () => {
    const payload = { user_metadata: { name: 'Martín 💸' }, amr: [{ method: 'password', timestamp: 1794300000 }] }
    expect(signedInAt(fakeToken(payload))).toBe(1794300000)
  })

  test('anything else → undefined, never an error', () => {
    for (const token of ['', 'no-es-un-token', 'a.b.c', fakeToken({}), fakeToken({ amr: 'password' }), fakeToken({ amr: [null, 1] })]) {
      expect(signedInAt(token)).toBeUndefined()
    }
    expect(signedInAt(fakeToken({ amr: [{ method: 'password', timestamp: '1794300000' }] }))).toBeUndefined()
  })
})

describe('signedInRecently', () => {
  const now = 1794300000 * 1000

  test(`up to ${RECENT_SIGN_IN_SECONDS / 60} minutes ago`, () => {
    expect(signedInRecently(now / 1000, now)).toBe(true)
    expect(signedInRecently(now / 1000 - RECENT_SIGN_IN_SECONDS, now)).toBe(true)
    expect(signedInRecently(now / 1000 - RECENT_SIGN_IN_SECONDS - 1, now)).toBe(false)
  })

  test('a clock a bit ahead (Supabase vs. the API) still counts; never signed in does not', () => {
    expect(signedInRecently(now / 1000 + 5, now)).toBe(true)
    expect(signedInRecently(undefined, now)).toBe(false)
  })
})
