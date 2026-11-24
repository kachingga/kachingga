import { Button } from '@/components/ui/button';
import { usePhotoInput } from '@/lib/use-photo-input';

/** A button that picks a photo (`usePhotoInput`). `loading`: while it's being uploaded. */
export function PhotoPicker({
  label,
  side,
  loading,
  onPhoto,
}: {
  label: string;
  side: number;
  loading?: boolean;
  onPhoto: (base64: string) => void;
}) {
  const photo = usePhotoInput({ side, onPhoto });
  return (
    <>
      {photo.input}
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={photo.preparing || loading}
        onClick={photo.open}
      >
        {label}
      </Button>
    </>
  );
}
