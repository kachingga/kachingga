import { afterAll, describe, expect, test } from 'bun:test'
import { configurePhotos, MAX_PHOTO_BYTES, MAX_PHOTO_SIDE, photoUrl, sanitizeJpeg } from '../lib/photos'
import { EXIF_WITH_GPS, fakeJpeg, jpegBlock } from './jpegFixture'

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

  test('nothing can hide between blocks: only the ones that draw the image, with exactly one frame', () => {
    const exif = jpegBlock(0xe1, EXIF_WITH_GPS)
    const bigFrame = jpegBlock(0xc2, [8, 0x17, 0x70, 0x17, 0x70, 1, 1, 0x11, 0]) // 6000×6000
    // A marker without a length (a restart) "wrapping" other blocks with a made-up one
    const hidden = [...exif, ...bigFrame]
    const wrapped = [0xff, 0xd0, ((hidden.length + 2) >> 8) & 0xff, (hidden.length + 2) & 0xff, ...hidden]
    for (const beforeFrame of [
      wrapped,
      bigFrame, // a second frame
      [0xff, 0xff, ...jpegBlock(0xdb, Array(65).fill(1))], // fill bytes
      [0xff, 0x01, 0, 4, 0, 0], // a marker without a length, read as one with
      jpegBlock(0xcc, [0, 0]), // arithmetic coding
      jpegBlock(0xf0, [0, 0]), // a JPEG extension
    ]) {
      expect(() => sanitizeJpeg(fakeJpeg({ beforeFrame }))).toThrow('Esa imagen no se puede usar')
    }
  })

  test('in the image data, only what can be there: no metadata, no frames, nothing unknown', () => {
    for (const inData of [
      jpegBlock(0xe1, EXIF_WITH_GPS),
      jpegBlock(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]),
      [0xff, 0xfe, 0, 2],
      [0xff, 0x01],
    ]) {
      expect(() => sanitizeJpeg(fakeJpeg({ inData }))).toThrow('Esa imagen no se puede usar')
    }
    // What a progressive JPEG has between scans, and restarts: fine
    const ok = sanitizeJpeg(
      fakeJpeg({ frame: 0xc2, inData: [0xff, 0xd3, 5, ...jpegBlock(0xc4, Array(20).fill(0)), ...jpegBlock(0xda, [1, 1, 0, 0, 63, 0]), 7] }),
    )
    expect([...ok.subarray(-2)]).toEqual([0xff, 0xd9])
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
