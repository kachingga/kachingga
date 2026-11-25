// A JPEG built by hand for the photo tests: the structure of the real ones (what Safari's canvas
// writes: JFIF, EXIF, Photoshop's block), with whatever pieces a test needs. Not a drawable image:
// the API never decodes it, it only reads its blocks (lib/photos.ts → sanitizeJpeg).
const text = (value: string) => [...value].map((c) => c.charCodeAt(0))
const block = (marker: number, payload: number[]) => [
  0xff,
  marker,
  ((payload.length + 2) >> 8) & 0xff,
  (payload.length + 2) & 0xff,
  ...payload,
]

/** A block with a length: [0xFF, marker, length, payload] (for tests that build their own). */
export const jpegBlock = block

export const EXIF_WITH_GPS = text('Exif\0\0GPS -34.6037 -58.3816')

export function fakeJpeg({
  width = 256,
  height = 256,
  frame = 0xc0,
  end = true,
  after = [] as number[],
  beforeFrame = [] as number[],
  inData = [] as number[],
} = {}) {
  return new Uint8Array([
    0xff,
    0xd8,
    ...block(0xe0, text('JFIF\0').concat([1, 1, 0, 0, 1, 0, 1, 0, 0])),
    ...block(0xe1, EXIF_WITH_GPS),
    ...block(0xed, text('Photoshop 3.0\0')),
    ...block(0xdb, Array(65).fill(1)),
    ...beforeFrame,
    ...block(frame, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 1, 1, 0x11, 0]),
    ...block(0xc4, Array(20).fill(0)),
    ...block(0xfe, text('un comentario')),
    ...block(0xda, [1, 1, 0, 0, 63, 0]),
    // The image data (0xFF 0x00 is how a 0xFF byte goes in it)
    1,
    2,
    3,
    0xff,
    0x00,
    4,
    ...inData,
    ...(end ? [0xff, 0xd9] : []),
    ...after,
  ])
}

export const fakeJpegBase64 = (options?: Parameters<typeof fakeJpeg>[0]) => Buffer.from(fakeJpeg(options)).toString('base64')
