import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useTRPC } from '@/lib/trpc';

export function JoinGroup() {
  const navigate = useNavigate();
  const trpc = useTRPC();

  const [codeInput, setCodeInput] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
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
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Volver" className="text-neutral-400">
          ←
        </button>
        <h1 className="text-xl font-bold">Unirme con código</h1>
      </div>

      {!showPreview && (
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400" htmlFor="code">
              Código de invitación
            </label>
            <input
              id="code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              required
              placeholder="AB3X7K2M"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-center font-mono text-xl uppercase tracking-widest text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
            />
          </div>
          {preview.isError && <p className="text-sm text-red-400">{preview.error.message}</p>}
          <button
            type="submit"
            disabled={preview.isFetching}
            className="w-full rounded-lg bg-white py-3 font-medium text-black disabled:opacity-50"
          >
            {preview.isFetching ? 'Buscando…' : 'Buscar grupo'}
          </button>
        </form>
      )}

      {showPreview && preview.isPending && (
        <p className="py-8 text-center text-neutral-400">Buscando grupo…</p>
      )}

      {showPreview && preview.isSuccess && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-neutral-900 p-4">
            <p className="text-sm text-neutral-400">Vas a unirte a</p>
            <p className="text-xl font-bold">{preview.data.name}</p>
            <p className="text-sm text-neutral-400">Moneda base: {preview.data.baseCurrency}</p>
          </div>

          {preview.data.alreadyMember ? (
            <p className="text-amber-400">Ya sos miembro de este grupo.</p>
          ) : (
            <div className="space-y-4">
              <p className="font-medium">¿Quién sos?</p>

              {preview.data.unclaimedParticipants.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-900 p-3"
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

              <label className="flex items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-900 p-3">
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
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                />
              )}

              {join.isError && <p className="text-sm text-red-400">{join.error.message}</p>}

              <button
                onClick={handleJoin}
                disabled={join.isPending || (joinAs === 'new' && !newName.trim())}
                className="w-full rounded-lg bg-white py-3 font-medium text-black disabled:opacity-50"
              >
                {join.isPending ? 'Uniéndome…' : 'Unirme'}
              </button>
            </div>
          )}

          <button
            onClick={() => setSubmittedCode(null)}
            className="w-full py-2 text-sm text-neutral-400 underline"
          >
            Ingresar otro código
          </button>
        </div>
      )}
    </main>
  );
}
