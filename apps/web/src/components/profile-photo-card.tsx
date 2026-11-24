import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Avatar, Card, SectionTitle } from '@/components/kit';
import { PhotoPicker } from '@/components/photo-picker';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth';
import { PROFILE_PHOTO_SIDE } from '@/lib/photo';
import { useTRPC } from '@/lib/trpc';

/** My photo (Mi cuenta): the one my groups see. Hidden when the API has photos off. */
export function ProfilePhotoCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const session = useSession();
  const config = useQuery(trpc.photos.config.queryOptions(undefined, { staleTime: Infinity }));
  const profile = useQuery(trpc.profile.get.queryOptions());

  // It shows in every group: those refresh too.
  const changed = (photoUrl: string | null) => {
    queryClient.setQueryData(trpc.profile.get.queryKey(), (old) => old && { ...old, photoUrl });
    void queryClient.invalidateQueries(trpc.groups.pathFilter());
  };
  const setMine = useMutation(
    trpc.photos.setMine.mutationOptions({
      onSuccess: ({ photoUrl }) => {
        changed(photoUrl);
        toast.success('Listo: tus grupos ya ven tu foto.');
      },
      onError: (err) => toast.error(`No se subió la foto: ${err.message}`),
    }),
  );
  const removeMine = useMutation(
    trpc.photos.removeMine.mutationOptions({
      onSuccess: () => changed(null),
      onError: (err) => toast.error(`No se sacó la foto: ${err.message}`),
    }),
  );

  if (!config.data?.enabled || !profile.isSuccess || !session) return null;
  const photoUrl = profile.data.photoUrl;

  return (
    <Card className="flex items-center gap-4">
      <Avatar
        id={session.user.id}
        name={session.user.email ?? '?'}
        photoUrl={photoUrl}
        className="size-16 text-2xl ring-0"
      />
      <div className="min-w-0 flex-1">
        <SectionTitle>Tu foto</SectionTitle>
        <p className="text-sm text-muted-foreground">La ven las personas de tus grupos.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <PhotoPicker
            label={photoUrl ? 'Cambiar la foto' : 'Poner una foto'}
            side={PROFILE_PHOTO_SIDE}
            loading={setMine.isPending}
            onPhoto={(photo) => setMine.mutate({ photo })}
          />
          {photoUrl && (
            <Button
              variant="ghost"
              size="sm"
              loading={removeMine.isPending}
              onClick={() => removeMine.mutate()}
            >
              Sacarla
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
