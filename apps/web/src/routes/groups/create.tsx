import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';

import { currencies } from '@kachingga/api/schemas';
import { useTRPC } from '@/lib/trpc';
import { currencyLabels, type Currency } from '@/lib/format';

export function CreateGroup() {
  const navigate = useNavigate();
  const trpc = useTRPC();

  const [name, setName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState<Currency>('ARS');
  const [myName, setMyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; inviteCode: string } | null>(null);

  const createGroup = useMutation(
    trpc.groups.create.mutationOptions({
      onSuccess: (data) => setCreated({ id: data.id, inviteCode: data.inviteCode }),
      onError: (err) => setError(err.message),
    }),
  );

  if (created) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
        <h2 className="mb-2 text-xl font-bold">Grupo creado</h2>
        <p className="mb-6 text-muted-foreground">Compartí este código para que otros se unan:</p>

        <div className="mb-6 rounded-2xl bg-card p-6 text-center">
          <p className="font-mono text-3xl font-bold tracking-widest">{created.inviteCode}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void navigator.clipboard.writeText(created.inviteCode)}
            className="flex-1 rounded-lg border border-input py-3 font-medium text-foreground"
          >
            Copiar código
          </button>
          <button
            onClick={() => navigate(`/grupos/${created.id}`)}
            className="flex-1 rounded-lg bg-primary py-3 font-medium text-primary-foreground"
          >
            Ir al grupo
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-muted-foreground">
          ←
        </button>
        <h1 className="text-xl font-bold">Crear grupo</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          createGroup.mutate({ name, baseCurrency, myName });
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="name">
            Nombre del grupo
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Viaje a Bariloche"
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="currency">
            Moneda base
          </label>
          <select
            id="currency"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as Currency)}
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {currencyLabels[c]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="myName">
            ¿Cómo te llamás en este grupo?
          </label>
          <input
            id="myName"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            required
            placeholder="Juan"
            className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={createGroup.isPending}
          className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-50"
        >
          {createGroup.isPending ? 'Creando…' : 'Crear grupo'}
        </button>
      </form>
    </main>
  );
}
