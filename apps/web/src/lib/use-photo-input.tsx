import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { photoToJpeg } from '@/lib/photo';

/**
 * The phone's photo picker (or the camera), hidden: `open()` shows it (from a tap) and `onPhoto`
 * gets the photo ready to upload (`photoToJpeg`). Render `input` somewhere in the page.
 */
export function usePhotoInput({
  side,
  onPhoto,
}: {
  side: number;
  onPhoto: (base64: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPreparing(true);
    try {
      onPhoto(await photoToJpeg(file, side));
    } catch {
      toast.error('No pudimos leer esa imagen. Probá con otra foto.');
    } finally {
      setPreparing(false);
      if (ref.current) ref.current.value = '';
    }
  }

  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      data-testid="photo-input"
      onChange={(e) => void handleFile(e.target.files?.[0])}
    />
  );
  return { open: () => ref.current?.click(), input, preparing };
}
