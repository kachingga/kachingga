import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';

import { currencies } from '@kachingga/api/schemas';
import { Card, Field, Page, PageHeader } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { shareInviteCode } from '@/lib/share';
import { useTRPC } from '@/lib/trpc';
import { currencyLabels, type Currency } from '@/lib/format';

export function CreateGroup() {
  const navigate = useNavigate();
  const trpc = useTRPC();

  const [name, setName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<Currency>('ARS');
  const [myName, setMyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: string;
    name: string;
    inviteCode: string;
  } | null>(null);

  const createGroup = useMutation(
    trpc.groups.create.mutationOptions({
      onSuccess: (data) =>
        setCreated({ id: data.id, name: data.name, inviteCode: data.inviteCode }),
      onError: (err) => setError(err.message),
    }),
  );

  if (created) {
    return (
      <Page className="flex min-h-[60dvh] flex-col justify-center">
        <h2 className="text-3xl font-bold">Grupo creado</h2>
        <p className="-mt-3 text-muted-foreground">Compartí este código para que otros se unan:</p>

        <div className="rounded-3xl bg-hero p-8 text-center text-primary-foreground shadow-lift dark:text-foreground">
          <p className="font-mono text-4xl font-bold tracking-widest">{created.inviteCode}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => void shareInviteCode(created.name, created.inviteCode)}
          >
            Compartir código
          </Button>
          <Button size="lg" className="flex-1" onClick={() => navigate(`/grupos/${created.id}`)}>
            Ir al grupo
          </Button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Crear grupo" back={{ onClick: () => navigate(-1), label: 'Volver' }} />

      <Card className="rise">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            createGroup.mutate({ name, baseCurrency, myName });
          }}
          className="space-y-4"
        >
          <Field label="Nombre del grupo" htmlFor="name">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Viaje a Bariloche"
            />
          </Field>

          <Field label="Moneda base" htmlFor="currency">
            <NativeSelect
              id="currency"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value as Currency)}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {currencyLabels[c]}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="¿Cómo te llamás en este grupo?" htmlFor="myName">
            <Input
              id="myName"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              required
              placeholder="Juan"
            />
          </Field>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full" loading={createGroup.isPending}>
            {createGroup.isPending ? 'Creando…' : 'Crear grupo'}
          </Button>
        </form>
      </Card>
    </Page>
  );
}
