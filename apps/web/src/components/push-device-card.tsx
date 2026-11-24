import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';

import { Card, SectionTitle } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth';
import { currentEndpoint, pushSupport, subscribeHere, unsubscribeHere } from '@/lib/push';
import { useTRPC } from '@/lib/trpc';

const MESSAGES = {
  'needs-install':
    'En iPhone y iPad llegan solo con Kachingga en la pantalla de inicio: en Safari, tocá Compartir → "Agregar a inicio" y abrila desde el ícono.',
  denied:
    'Las bloqueaste en este navegador. Para recibirlas, permitilas en la configuración del navegador (o del celu) para Kachingga.',
  unsupported: 'Este navegador no puede recibir notificaciones.',
};

/**
 * Notifications on this device: turn them on (asks the browser's permission) or off. `prompt`: the
 * short version at the top of the notifications screen, only while they're off here and could be turned on.
 * Hidden when the API has them off (no VAPID keys).
 */
export function PushDeviceCard({ prompt = false }: { prompt?: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const session = useSession();
  const config = useQuery(
    trpc.notifications.pushConfig.queryOptions(undefined, { staleTime: Infinity }),
  );
  const [support, setSupport] = useState(pushSupport);
  // This browser's subscription: undefined while checking
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    void currentEndpoint().then((found) => active && setEndpoint(found));
    return () => {
      active = false;
    };
  }, []);
  const status = useQuery(
    trpc.notifications.deviceStatus.queryOptions(
      { endpoint: endpoint ?? '' },
      { enabled: Boolean(endpoint) },
    ),
  );
  const statusKey = (forEndpoint: string) =>
    trpc.notifications.deviceStatus.queryKey({ endpoint: forEndpoint });

  const subscribe = useMutation(
    trpc.notifications.subscribeDevice.mutationOptions({
      onSuccess: (_data, input) => {
        queryClient.setQueryData(statusKey(input.endpoint), { subscribed: true });
        setEndpoint(input.endpoint);
        toast.success('Listo: te van a llegar a este dispositivo.');
      },
      onError: (err) => toast.error(`No se activaron: ${err.message}`),
    }),
  );
  const unsubscribe = useMutation(
    trpc.notifications.unsubscribeDevice.mutationOptions({
      onSuccess: (_data, input) => {
        queryClient.setQueryData(statusKey(input.endpoint), { subscribed: false });
        void unsubscribeHere();
        setEndpoint(null);
      },
      onError: (err) => toast.error(`No se desactivaron: ${err.message}`),
    }),
  );
  const [asking, setAsking] = useState(false);

  const publicKey = config.data?.publicKey;
  if (!publicKey || endpoint === undefined || (endpoint && status.isPending)) return null;
  const on = Boolean(endpoint) && status.data?.subscribed === true;

  async function enable() {
    if (!publicKey || !session) return;
    setAsking(true);
    try {
      const device = await subscribeHere(publicKey, session.user.id);
      setSupport(pushSupport());
      if (device) subscribe.mutate(device);
    } catch {
      toast.error('No se pudieron activar en este navegador.');
    } finally {
      setAsking(false);
    }
  }

  if (prompt) {
    if (on || (support !== 'available' && support !== 'needs-install')) return null;
    return (
      <Card className="rise flex items-start gap-3">
        <BellRing aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-ink" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-semibold">¿Te avisamos en este dispositivo?</p>
            <p className="text-sm text-muted-foreground">
              {support === 'needs-install'
                ? MESSAGES['needs-install']
                : 'Cuando alguien cargue un gasto o un pago en el que estás, te llega una notificación, como en cualquier app.'}
            </p>
          </div>
          {support === 'available' && (
            <Button size="sm" onClick={() => void enable()} loading={asking || subscribe.isPending}>
              Activar
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Notificaciones en este dispositivo</SectionTitle>
      <p className="mt-1 text-sm text-muted-foreground">
        Te llegan como en cualquier app cuando cambia un gasto o un pago en el que estás. En la
        campanita de la app siempre las ves.
      </p>
      {support === 'available' ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">{on ? 'Activadas' : 'Desactivadas'}</p>
          {on ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => unsubscribe.mutate({ endpoint: endpoint! })}
              loading={unsubscribe.isPending}
            >
              Desactivar
            </Button>
          ) : (
            <Button size="sm" onClick={() => void enable()} loading={asking || subscribe.isPending}>
              Activar
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm">{MESSAGES[support]}</p>
      )}
      {on && (
        <p className="mt-3 text-xs text-muted-foreground">
          Para dejar de recibir las de un grupo: en el grupo, menú ⋯ → "Silenciar notificaciones".
        </p>
      )}
    </Card>
  );
}
