import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { currencies } from '@kachingga/api/schemas';
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
      <div className="mx-auto w-full max-w-2xl space-y-6 flex min-h-[60dvh] flex-col justify-center">
        <h2 className="text-3xl font-bold">Grupo creado</h2>
        <p className="-mt-3 text-muted-foreground">Compartí este código para que otros se unan:</p>

        <div className="rounded-3xl bg-hero p-8 text-center text-primary-foreground shadow-lift dark:text-foreground">
          <p className="font-mono text-4xl font-bold tracking-widest">{created.inviteCode}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void shareInviteCode(created.name, created.inviteCode)}
            className="press flex-1 rounded-full border border-input py-3 font-semibold text-foreground bg-card"
          >
            Compartir código
          </button>
          <button
            onClick={() => navigate(`/grupos/${created.id}`)}
            className="press flex-1 rounded-full bg-primary py-3 font-semibold text-primary-foreground shadow-soft"
          >
            Ir al grupo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rise flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          className="press grid size-9 shrink-0 place-items-center rounded-full text-lg text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-bold lg:text-3xl">Crear grupo</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          createGroup.mutate({ name, baseCurrency, myName });
        }}
        className="rise rounded-2xl border bg-card p-5 shadow-soft space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="name">
            Nombre del grupo
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Viaje a Bariloche"
            className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="currency">
            Moneda base
          </label>
          <select
            id="currency"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as Currency)}
            className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {currencyLabels[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="myName">
            ¿Cómo te llamás en este grupo?
          </label>
          <input
            id="myName"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            required
            placeholder="Juan"
            className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={createGroup.isPending}
          className="press w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50 shadow-soft"
        >
          {createGroup.isPending ? 'Creando…' : 'Crear grupo'}
        </button>
      </form>
    </div>
  );
}
