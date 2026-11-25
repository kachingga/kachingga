// Profile and group photos (root CLAUDE.md → "Fotos"), in a private Cloudflare R2 bucket. The
// browser never talks to the bucket to upload: it sends the photo to the API, which cleans it
// (sanitizeJpeg) and stores it. To show it, the API hands out signed links that expire. Off without
// the R2_* variables (local, tests, CI): `configurePhotos` is called at startup (index.ts).
import { TRPCError } from '@trpc/server'
import { S3Client } from 'bun'
import { prisma } from '../db'
import { reportError } from './monitoring'

export const MAX_PHOTO_BYTES = 300_000
export const MAX_PHOTO_SIDE = 2048
// A signed link is valid this long, and the same one is handed out until it has a day left: the
// browser keeps the photo cached instead of downloading it again with every new link.
const LINK_SECONDS = 7 * 24 * 60 * 60
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000
const MAX_CACHED_LINKS = 20_000

export const UNAVAILABLE_MESSAGE = 'Las fotos no están disponibles por ahora.'
export const INVALID_PHOTO_MESSAGE = 'Esa imagen no se puede usar: probá con otra foto.'

/** Where the photos live. R2 in production; a fake one in tests. */
export type PhotoStore = {
  put: (key: string, jpeg: Uint8Array) => Promise<void>
  remove: (key: string) => Promise<void>
  /** A signed link to read it, valid for `seconds`. */
  sign: (key: string, seconds: number) => string
}

function r2Store(env: Record<string, string | undefined>): PhotoStore | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return null
  const client = new S3Client({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET,
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
  })
  return {
    put: async (key, jpeg) => void (await client.write(key, jpeg, { type: 'image/jpeg' })),
    remove: (key) => client.delete(key),
    sign: (key, seconds) => client.presign(key, { expiresIn: seconds, method: 'GET' }),
  }
}

let store: PhotoStore | null = null
const links = new Map<string, { url: string; renewAt: number }>()

/** Turns photos on with the R2 variables (INFRA.md), or off without them. `fake`: for tests. */
export function configurePhotos(env: Record<string, string | undefined> = process.env, fake?: PhotoStore) {
  store = fake ?? r2Store(env)
  links.clear()
  return store !== null
}

export const photosEnabled = () => store !== null

function requireStore() {
  if (!store) throw new TRPCError({ code: 'BAD_REQUEST', message: UNAVAILABLE_MESSAGE })
  return store
}

/** The photo key of each of these accounts that has one (to show their photos in a group). */
export async function profilePhotoKeys(userIds: (string | null)[]): Promise<Map<string | null, string>> {
  const ids = [...new Set(userIds.filter((userId): userId is string => userId !== null))]
  if (ids.length === 0 || !store) return new Map()
  const profiles = await prisma.userProfile.findMany({
    where: { userId: { in: ids }, photoKey: { not: null } },
    select: { userId: true, photoKey: true },
  })
  return new Map(profiles.map((p) => [p.userId, p.photoKey!]))
}

/** The link to show a photo (null without one, or with photos off). The same for days. */
export function photoUrl(key: string | null | undefined, now = Date.now()): string | null {
  if (!key || !store) return null
  const cached = links.get(key)
  if (cached && cached.renewAt > now) return cached.url
  if (links.size >= MAX_CACHED_LINKS) links.clear()
  const url = store.sign(key, LINK_SECONDS)
  links.set(key, { url, renewAt: now + LINK_SECONDS * 1000 - RENEW_BEFORE_MS })
  return url
}

/**
 * Cleans an uploaded photo and stores it under a new random key (never anything about who it
 * belongs to: the link is seen by other members). Returns the key.
 */
export async function storePhoto(base64: string): Promise<string> {
  const target = requireStore()
  const jpeg = sanitizeJpeg(new Uint8Array(Buffer.from(base64, 'base64')))
  const key = `fotos/${crypto.randomUUID()}.jpg`
  await target.put(key, jpeg)
  return key
}

/** Deletes a photo that's no longer used. A failure leaves an orphan behind (reported, not fatal). */
export async function deletePhoto(key: string | null | undefined) {
  if (!key || !store) return
  links.delete(key)
  await store.remove(key).catch((error: unknown) => reportError(error, { feature: 'photos' }))
}

// Blocks before the image data: kept (tables, the frame, restart interval) or dropped (metadata).
const DQT = 0xdb
const DHT = 0xc4
const DRI = 0xdd
const SOS = 0xda
const FRAMES = new Set([0xc0, 0xc1, 0xc2]) // baseline, extended, progressive: what a canvas makes
const isMetadata = (marker: number) => (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe
const isRestart = (marker: number) => marker >= 0xd0 && marker <= 0xd7

/**
 * Keeps only what's needed to draw a JPEG, and only if it's an ordinary one (what a browser's canvas
 * makes): a strict allowlist, so nothing can hide in between. Before the image data: the tables,
 * exactly one frame (baseline or progressive, up to MAX_PHOTO_SIDE per side) and the restart
 * interval are kept; every metadata block goes (APP0–APP15: EXIF with the GPS location, XMP, the
 * camera's, Photoshop's; and comments); anything else is rejected. In the image data only what can
 * be there is accepted (escaped bytes, restarts, and the tables and scans of a progressive JPEG),
 * up to its end; whatever follows is dropped. Up to MAX_PHOTO_BYTES. The browser already re-encodes
 * it in a canvas (apps/web/src/lib/photo.ts), but Safari's canvas still writes EXIF, and a client
 * can send anything.
 */
export function sanitizeJpeg(bytes: Uint8Array): Uint8Array {
  const fail = () => new TRPCError({ code: 'BAD_REQUEST', message: INVALID_PHOTO_MESSAGE })
  if (bytes.length > MAX_PHOTO_BYTES || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw fail()
  // A block with a length: [0xFF, marker, length (2 bytes, counts itself), payload]
  const blockEnd = (at: number) => {
    if (at + 4 > bytes.length) throw fail()
    const length = (bytes[at + 2]! << 8) | bytes[at + 3]!
    const end = at + 2 + length
    if (length < 2 || end > bytes.length) throw fail()
    return end
  }

  const kept: Uint8Array[] = [bytes.subarray(0, 2)]
  let size: { width: number; height: number } | null = null
  let i = 2
  // Up to the start of the image data
  for (;;) {
    if (bytes[i] !== 0xff) throw fail()
    const marker = bytes[i + 1]!
    const isKnown = isMetadata(marker) || FRAMES.has(marker) || marker === DQT || marker === DHT || marker === DRI || marker === SOS
    if (!isKnown) throw fail() // fill bytes, restarts, another start or end, hierarchical, arithmetic…
    const end = blockEnd(i)
    if (FRAMES.has(marker)) {
      if (size || end - i < 10) throw fail() // exactly one frame
      size = { height: (bytes[i + 5]! << 8) | bytes[i + 6]!, width: (bytes[i + 7]! << 8) | bytes[i + 8]! }
    }
    if (!isMetadata(marker)) kept.push(bytes.subarray(i, end))
    i = end
    if (marker === SOS) break
  }
  if (!size || size.width === 0 || size.height === 0 || size.width > MAX_PHOTO_SIDE || size.height > MAX_PHOTO_SIDE) throw fail()

  // The image data, up to the end-of-image marker
  const dataStart = i
  for (;;) {
    if (i + 1 >= bytes.length) throw fail() // never ends
    if (bytes[i] !== 0xff) {
      i += 1
      continue
    }
    const next = bytes[i + 1]!
    if (next === 0x00 || isRestart(next))
      i += 2 // an escaped 0xFF byte, or a restart
    else if (next === 0xd9)
      break // the end
    else if (next === DHT || next === DQT || next === DRI || next === SOS)
      i = blockEnd(i) // between scans (progressive)
    else throw fail()
  }
  kept.push(bytes.subarray(dataStart, i + 2))

  const out = new Uint8Array(kept.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of kept) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
