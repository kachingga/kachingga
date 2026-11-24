import { afterAll, describe, expect, test } from 'bun:test'
import { configurePhotos, MAX_PHOTO_BYTES, MAX_PHOTO_SIDE, photoUrl, sanitizeJpeg } from '../lib/photos'
import { EXIF_WITH_GPS, fakeJpeg } from './jpegFixture'

const markers = (bytes: Uint8Array) => {
  const found: number[] = []
  for (let i = 2; i + 3 < bytes.length; ) {
    const marker = bytes[i + 1]!
    found.push(marker)
    if (marker === 0xda) break
    i += 2 + ((bytes[i + 2]! << 8) | bytes[i + 3]!)
  }
  return found
}
const contains = (bytes: Uint8Array, part: number[]) => Buffer.from(bytes).includes(Buffer.from(part))

describe('sanitizeJpeg', () => {
  test('keeps what draws the image and drops every metadata block (EXIF with GPS, Photoshop, comments)', () => {
    const clean = sanitizeJpeg(fakeJpeg())
    expect(markers(clean)).toEqual([0xdb, 0xc0, 0xc4, 0xda])
    expect(contains(clean, EXIF_WITH_GPS)).toBe(false)
    expect([...clean.subarray(0, 2)]).toEqual([0xff, 0xd8])
    expect([...clean.subarray(-2)]).toEqual([0xff, 0xd9])
    // The image data, untouched
    expect(contains(clean, [1, 2, 3, 0xff, 0x00, 4, 0xff, 0xd9])).toBe(true)
  })

  test('drops anything hidden after the end of the image', () => {
    const clean = sanitizeJpeg(fakeJpeg({ after: [...Buffer.from('<script>alert(1)</script>')] }))
    expect([...clean.subarray(-2)]).toEqual([0xff, 0xd9])
    expect(Buffer.from(clean).includes(Buffer.from('<script>'))).toBe(false)
  })

  test('progressive JPEGs too', () => {
    expect(markers(sanitizeJpeg(fakeJpeg({ frame: 0xc2 })))).toContain(0xc2)
  })

  test.each([
    ['not a JPEG', new Uint8Array([...Buffer.from('\x89PNG\r\n\x1a\n')])],
    ['empty', new Uint8Array()],
    ['without the end of the image', fakeJpeg({ end: false })],
    ['too big a side', fakeJpeg({ width: MAX_PHOTO_SIDE + 1 })],
    ['zero size', fakeJpeg({ height: 0 })],
    ['a kind a canvas never makes (lossless)', fakeJpeg({ frame: 0xc3 })],
    ['cut in the middle', fakeJpeg().subarray(0, 40)],
    ['too heavy', new Uint8Array(MAX_PHOTO_BYTES + 1)],
  ])('rejects %s', (_case, bytes) => {
    expect(() => sanitizeJpeg(bytes)).toThrow('Esa imagen no se puede usar')
  })
})

describe('photoUrl', () => {
  let signed = 0
  configurePhotos({}, { put: async () => {}, remove: async () => {}, sign: (key) => `https://fotos.test/${key}?firma=${++signed}` })
  afterAll(() => configurePhotos({}))

  test('the same link for days (the browser keeps the photo cached), and a new one before it expires', () => {
    const now = Date.now()
    const first = photoUrl('fotos/a.jpg', now)
    expect(photoUrl('fotos/a.jpg', now + 5 * 24 * 3600_000)).toBe(first)
    const renewed = photoUrl('fotos/a.jpg', now + 6 * 24 * 3600_000 + 1)
    expect(renewed).not.toBe(first)
    expect(renewed).toStartWith('https://fotos.test/fotos/a.jpg')
  })

  test('without a photo, or with photos off: null', () => {
    expect(photoUrl(null)).toBeNull()
    configurePhotos({})
    expect(photoUrl('fotos/a.jpg')).toBeNull()
  })
})
