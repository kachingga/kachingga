// http_ece (what web-push encrypts with) has no types: only what push.test.ts uses to decrypt like a browser.
declare module 'http_ece' {
  export function decrypt(
    buffer: Buffer,
    params: { version: 'aes128gcm'; privateKey: import('node:crypto').ECDH; authSecret: string },
  ): Buffer
}
