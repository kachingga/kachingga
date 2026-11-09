import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { useTRPC } from '@/lib/trpc';

export function JoinGroup() {
  const navigate = useNavigate();
  const trpc = useTRPC();

  // A shared invite link (`/grupos/unirme?codigo=…`) opens with the code already looked up.
  const [searchParams] = useSearchParams();
  const linkCode = searchParams.get('codigo')?.trim().toUpperCase() || null;
  const [codeInput, setCodeInput] = useState(linkCode ?? '');
  const [submittedCode, setSubmittedCode] = useState<string | null>(linkCode);
  const [joinAs, setJoinAs] = useState<'new' | 'claim'>('new');
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const preview = useQuery({
    ...trpc.groups.preview.queryOptions({ inviteCode: submittedCode ?? '' }),
    enabled: submittedCode !== null,
  });

  const join = useMutation(
    trpc.groups.join.mutationOptions({
      onSuccess: (data) => navigate(`/grupos/${data.groupId}`),
    }),
  );

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedCode(codeInput.trim().toUpperCase());
  }

  function handleJoin() {
    if (!submittedCode) return;
    if (joinAs === 'claim' && selectedParticipantId) {
      join.mutate({ inviteCode: submittedCode, participantId: selectedParticipantId });
    } else {
      join.mutate({ inviteCode: submittedCode, name: newName });
    }
  }

  const showPreview = submittedCode !== null && !preview.isError;

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
        <h1 className="text-2xl font-bold lg:text-3xl">Unirme con código</h1>
      </div>

      {!showPreview && (
        <form
          onSubmit={handleCodeSubmit}
          className="rise rounded-2xl border bg-card p-5 shadow-soft space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="code">
              Código de invitación
            </label>
            <input
              id="code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              required
              placeholder="AB3X7K2M"
              className="mt-1.5 text-center font-mono uppercase tracking-widest h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
            />
          </div>
          {preview.isError && <p className="text-sm text-destructive">{preview.error.message}</p>}
          <button
            type="submit"
            disabled={preview.isFetching}
            className="press w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50 shadow-soft"
          >
            {preview.isFetching ? 'Buscando…' : 'Buscar grupo'}
          </button>
        </form>
      )}

      {showPreview && preview.isPending && (
        <p className="py-8 text-center text-muted-foreground">Buscando grupo…</p>
      )}

      {showPreview && preview.isSuccess && (
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <p className="text-sm text-muted-foreground">Vas a unirte a</p>
            <p className="text-2xl font-bold lg:text-3xl">{preview.data.name}</p>
            <p className="text-sm text-muted-foreground">
              Moneda base: {preview.data.baseCurrency}
            </p>
          </div>

          {preview.data.alreadyMember ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">Ya sos parte de este grupo.</p>
              <Link
                to={`/grupos/${preview.data.id}`}
                className="press block w-full rounded-full bg-primary py-3 text-center font-semibold text-primary-foreground shadow-soft"
              >
                Ir al grupo
              </Link>
            </div>
          ) : (
            <div className="rise rounded-2xl border bg-card p-5 shadow-soft space-y-4">
              <p className="font-medium">¿Quién sos?</p>

              {preview.data.unclaimedParticipants.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-input bg-card p-3"
                >
                  <input
                    type="radio"
                    name="who"
                    checked={joinAs === 'claim' && selectedParticipantId === p.id}
                    onChange={() => {
                      setJoinAs('claim');
                      setSelectedParticipantId(p.id);
                    }}
                  />
                  <span>Soy {p.name}</span>
                </label>
              ))}

              <label className="flex items-center gap-3 rounded-xl border border-input bg-card p-3">
                <input
                  type="radio"
                  name="who"
                  checked={joinAs === 'new'}
                  onChange={() => {
                    setJoinAs('new');
                    setSelectedParticipantId(null);
                  }}
                />
                <span>Soy nuevo</span>
              </label>

              {joinAs === 'new' && (
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="¿Cómo te llamás?"
                  className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                />
              )}

              {join.isError && <p className="text-sm text-destructive">{join.error.message}</p>}

              <button
                onClick={handleJoin}
                disabled={join.isPending || (joinAs === 'new' && !newName.trim())}
                className="press w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50 shadow-soft"
              >
                {join.isPending ? 'Uniéndome…' : 'Unirme'}
              </button>
            </div>
          )}

          <button
            onClick={() => setSubmittedCode(null)}
            className="w-full py-2 text-sm text-muted-foreground underline"
          >
            Ingresar otro código
          </button>
        </div>
      )}
    </div>
  );
}
