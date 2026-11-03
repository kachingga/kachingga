// No 0/O/1/I/L to avoid typos when sharing the code by voice or chat.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateInviteCode(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}
