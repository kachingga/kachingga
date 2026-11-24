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

/**
 * Keeps only what's needed to draw a JPEG: the tables, the frame and the scan data. Every
 * metadata block goes (APP0–APP15: EXIF with the GPS location, XMP, the camera's, Photoshop's;
 * and comments), and anything after its end. Only baseline or progressive JPEGs, up to
 * MAX_PHOTO_BYTES and MAX_PHOTO_SIDE per side. The browser already re-encodes it in a canvas
 * (src/lib/photo.ts), but Safari's canvas still writes EXIF, and a client can send anything.
 */
export function sanitizeJpeg(bytes: Uint8Array): Uint8Array {
  const fail = () => new TRPCError({ code: 'BAD_REQUEST', message: INVALID_PHOTO_MESSAGE })
  if (bytes.length > MAX_PHOTO_BYTES || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw fail()

  const kept: Uint8Array[] = [bytes.subarray(0, 2)]
  let size: { width: number; height: number } | null = null
  let i = 2
  for (;;) {
    if (i + 4 > bytes.length || bytes[i] !== 0xff) throw fail()
    const marker = bytes[i + 1]!
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!
    const end = i + 2 + length
    if (length < 2 || end > bytes.length) throw fail()
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (length < 8) throw fail()
      size = { height: (bytes[i + 5]! << 8) | bytes[i + 6]!, width: (bytes[i + 7]! << 8) | bytes[i + 8]! }
    } else if (marker >= 0xc3 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      throw fail() // lossless, hierarchical or arithmetic: not what a canvas makes
    }
    const metadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe
    if (!metadata) kept.push(bytes.subarray(i, end))
    i = end
    // Start of scan: from here on it's the image data, up to the end-of-image marker
    if (marker === 0xda) break
  }
  if (!size || size.width === 0 || size.height === 0 || size.width > MAX_PHOTO_SIDE || size.height > MAX_PHOTO_SIDE) throw fail()
  let eoi = -1
  for (let j = bytes.length - 2; j >= i; j--) {
    if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
      eoi = j
      break
    }
  }
  if (eoi === -1) throw fail()
  kept.push(bytes.subarray(i, eoi + 2))

  const out = new Uint8Array(kept.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of kept) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
