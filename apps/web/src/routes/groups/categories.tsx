import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { ArchivedNotice } from '@/components/archived-notice';
import { CategoryEditor, type CategoryDraft } from '@/components/category-editor';
import { ErrorState } from '@/components/error-state';
import { Card, CategoryIcon, Page, PageHeader, SectionTitle } from '@/components/kit';
import { ListScreenSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { useTRPC } from '@/lib/trpc';
import { useConfirm } from '@/lib/use-confirm';

/**
 * The group's categories: any member can add one, rename it, change its icon and color, and
 * archive it (archived ones stay on their expenses but can't be picked for new ones).
 */
export function Categories() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const group = useQuery(trpc.groups.get.queryOptions({ groupId: groupId! }));
  const categories = useQuery(trpc.categories.list.queryOptions({ groupId: groupId! }));

  // Which category is open for editing ('new' = the "Nueva categoría" form).
  const [editing, setEditing] = useState<string | null>(null);

  // A category's name, icon or color shows up on expenses, filters and totals too.
  const refresh = () => {
    void queryClient.invalidateQueries(trpc.categories.pathFilter());
    void queryClient.invalidateQueries(trpc.expenses.pathFilter());
  };
  const onError = (e: { message: string }) => toast.error(e.message);

  const create = useMutation(
    trpc.categories.create.mutationOptions({
      onSuccess: () => {
        refresh();
        setEditing(null);
        toast.success('Categoría creada');
      },
      onError,
    }),
  );
  const update = useMutation(
    trpc.categories.update.mutationOptions({
      onSuccess: () => {
        refresh();
        setEditing(null);
      },
      onError,
    }),
  );
  const archive = useMutation(
    trpc.categories.archive.mutationOptions({
      onSuccess: () => {
        refresh();
        setEditing(null);
      },
      onError,
    }),
  );
  const unarchive = useMutation(
    trpc.categories.unarchive.mutationOptions({ onSuccess: refresh, onError }),
  );

  if (group.isPending || categories.isPending) return <ListScreenSkeleton />;
  if (group.isError || categories.isError) {
    const error = group.error ?? categories.error;
    return (
      <ErrorState
        message={error?.message ?? 'No se pudieron cargar las categorías'}
        onRetry={() => {
          void group.refetch();
          void categories.refetch();
        }}
      />
    );
  }

  const isArchived = !!group.data.archivedAt;
  const active = categories.data.filter((c) => !c.archived);
  const archived = categories.data.filter((c) => c.archived);

  async function askArchive(id: string, name: string, expenseCount: number) {
    const ok = await confirm({
      title: `¿Archivar "${name}"?`,
      description:
        expenseCount > 0
          ? `Sus ${expenseCount} gasto${expenseCount === 1 ? '' : 's'} la conservan, pero no se va a poder elegir para gastos nuevos.`
          : 'No se va a poder elegir para gastos nuevos. La podés desarchivar cuando quieras.',
      confirmLabel: 'Archivar',
    });
    if (ok) archive.mutate({ categoryId: id });
  }

  return (
    <Page>
      <PageHeader
        title="Categorías"
        subtitle={group.data.name}
        back={{ onClick: () => navigate(-1), label: 'Volver' }}
        actions={
          !isArchived &&
          editing !== 'new' && (
            <Button onClick={() => setEditing('new')}>
              <Plus />
              Nueva categoría
            </Button>
          )
        }
      />

      {isArchived && <ArchivedNotice groupId={group.data.id} />}

      {editing === 'new' && (
        <Card className="rise">
          <SectionTitle className="mb-4">Nueva categoría</SectionTitle>
          <CategoryEditor
            submitLabel="Crear"
            pending={create.isPending}
            onSubmit={(draft) => create.mutate({ groupId: groupId!, ...draft })}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      <Card className="rise p-0">
        <ul>
          {active.map((c) => (
            <li key={c.id} className="border-b p-4 last:border-0">
              {editing === c.id ? (
                <div className="space-y-4">
                  <CategoryEditor
                    initial={c as CategoryDraft}
                    submitLabel="Guardar"
                    pending={update.isPending}
                    onSubmit={(draft) => update.mutate({ categoryId: c.id, ...draft })}
                    onCancel={() => setEditing(null)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    disabled={archive.isPending || active.length === 1}
                    onClick={() => void askArchive(c.id, c.name, c.expenseCount)}
                  >
                    <Archive />
                    Archivar categoría
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <CategoryIcon icon={c.icon} color={c.color} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {expenseCountLabel(c.expenseCount)}
                    </p>
                  </div>
                  {!isArchived && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${c.name}`}
                      onClick={() => setEditing(c.id)}
                    >
                      <Pencil />
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {archived.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Archivadas</SectionTitle>
          <Card className="p-0">
            <ul>
              {archived.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b p-4 last:border-0">
                  <CategoryIcon icon={c.icon} color={c.color} className="opacity-60" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-muted-foreground">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {expenseCountLabel(c.expenseCount)}
                    </p>
                  </div>
                  {!isArchived && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={unarchive.isPending}
                      onClick={() => unarchive.mutate({ categoryId: c.id })}
                    >
                      <ArchiveRestore />
                      Desarchivar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </Page>
  );
}

const expenseCountLabel = (n: number) =>
  n === 0 ? 'Sin gastos' : `${n} gasto${n === 1 ? '' : 's'}`;
