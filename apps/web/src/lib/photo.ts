// Profile and group photos (root CLAUDE.md → "Fotos"): what the browser does before uploading one.

/** Sides of what's uploaded: a person's photo is shown small, a group's a bit bigger. */
export const PROFILE_PHOTO_SIDE = 256;
export const GROUP_PHOTO_SIDE = 512;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * The picked image, cut square from the center, made small (up to `side` px) and re-encoded as a
 * JPEG (Safari can't encode WebP): what the API takes, as base64. Read as a `data:` URL, which the
 * CSP already allows for images (a `blob:` one it doesn't). The API cleans it again anyway
 * (metadata, size): never trust only this.
 */
export async function photoToJpeg(file: File, side: number): Promise<string> {
  const image = new Image();
  image.src = await readAsDataUrl(file);
  await image.decode();
  const crop = Math.min(image.naturalWidth, image.naturalHeight);
  const out = Math.min(side, crop);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Sin canvas');
  context.drawImage(
    image,
    (image.naturalWidth - crop) / 2,
    (image.naturalHeight - crop) / 2,
    crop,
    crop,
    0,
    0,
    out,
    out,
  );
  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!jpeg) throw new Error('No se pudo convertir la imagen');
  const dataUrl = await readAsDataUrl(jpeg);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

/** A participant's photo, from the group (`groups.get`): their account's, if they have one. */
export function photoOf(
  group: { participants: { id: string; photoUrl: string | null }[] } | undefined,
  participantId: string,
): string | null {
  return group?.participants.find((p) => p.id === participantId)?.photoUrl ?? null;
}
