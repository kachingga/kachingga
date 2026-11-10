import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, Field, Page, PageHeader } from '@/components/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <Page>
      <PageHeader
        title="Unirme con código"
        back={{ onClick: () => navigate(-1), label: 'Volver' }}
      />

      {!showPreview && (
        <Card className="rise">
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <Field label="Código de invitación" htmlFor="code">
              <Input
                id="code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                required
                placeholder="AB3X7K2M"
                className="text-center font-mono uppercase tracking-widest"
              />
            </Field>
            {preview.isError && <p className="text-sm text-destructive">{preview.error.message}</p>}
            <Button type="submit" size="lg" className="w-full" loading={preview.isFetching}>
              {preview.isFetching ? 'Buscando…' : 'Buscar grupo'}
            </Button>
          </form>
        </Card>
      )}

      {showPreview && preview.isPending && (
        <p className="py-8 text-center text-muted-foreground">Buscando grupo…</p>
      )}

      {showPreview && preview.isSuccess && (
        <div className="space-y-6">
          <Card>
            <p className="text-sm text-muted-foreground">Vas a unirte a</p>
            <p className="text-2xl font-bold lg:text-3xl">{preview.data.name}</p>
            <p className="text-sm text-muted-foreground">
              Moneda base: {preview.data.baseCurrency}
            </p>
          </Card>

          {preview.data.alreadyMember ? (
            <div className="space-y-3">
              <p className="text-muted-foreground">Ya sos parte de este grupo.</p>
              <Button asChild size="lg" className="w-full">
                <Link to={`/grupos/${preview.data.id}`}>Ir al grupo</Link>
              </Button>
            </div>
          ) : (
            <Card className="rise space-y-4">
              <p className="font-medium">¿Quién sos?</p>

              {preview.data.unclaimedParticipants.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-input bg-card p-3"
                >
                  <input
                    type="radio"
                    name="who"
                    className="size-4 accent-primary"
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
                  className="size-4 accent-primary"
                  checked={joinAs === 'new'}
                  onChange={() => {
                    setJoinAs('new');
                    setSelectedParticipantId(null);
                  }}
                />
                <span>Soy nuevo</span>
              </label>

              {joinAs === 'new' && (
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="¿Cómo te llamás?"
                  aria-label="Tu nombre"
                />
              )}

              {join.isError && <p className="text-sm text-destructive">{join.error.message}</p>}

              <Button
                size="lg"
                className="w-full"
                onClick={handleJoin}
                loading={join.isPending}
                disabled={joinAs === 'new' && !newName.trim()}
              >
                {join.isPending ? 'Uniéndome…' : 'Unirme'}
              </Button>
            </Card>
          )}

          <Button
            variant="link"
            className="w-full text-muted-foreground"
            onClick={() => setSubmittedCode(null)}
          >
            Ingresar otro código
          </Button>
        </div>
      )}
    </Page>
  );
}
