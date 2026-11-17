import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { AppError, toAppError } from '@deseo/domain/result';
import { memoryInputSchema, type Memory, type MemoryInput } from '@deseo/domain/memories';
import { DateTime } from 'luxon';
import { useNavigate, useParams } from 'react-router-dom';
import { useSession } from '../../../app/SessionProvider';
import { useCommandId } from '../../../lib/command-id';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { queryClient } from '../../../lib/query-client';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { Dialog } from '../../../components/ui/Dialog';
import { getMemory, memoryKeys } from '../queries';
import { deleteMemory, updateMemory } from '../commands';
import { MemoryImage } from '../components/MemoryImage';
import { memoryPhotoQuery } from '../media';
import { PartnerBadge } from '../../../components/ui/PartnerBadge';
import '../../../styles/memories.css';
export function MemoryDetailPage() {
  const { memoryId = '' } = useParams();
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const command = useCommandId();
  const query = useQuery({ queryKey: memoryKeys.detail(account!.id, pairId, memoryId), queryFn: () => getMemory(pairId, memoryId), retry: false });
  const remove = useMutation({
    mutationFn: (version: number) => deleteMemory(memoryId, version, command.idFor({ memoryId, version })),
    onSuccess: () => { command.reset(); navigate('/memories'); },
    onError: () => void query.refetch(),
    onSettled: () => setConfirm(false),
  });
  // The photo on this page is in the query cache already, so a download reads no new bytes.
  const download = useMutation({ mutationFn: async ({ path, index }: { path: string; index: number }) => {
    const blob = await queryClient.fetchQuery(memoryPhotoQuery(account!.id, pairId, path));
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'deseo-memory-' + memoryId + '-' + (index + 1) + '.jpg'; anchor.click();
    } finally { URL.revokeObjectURL(url); }
  } });
  const busy = remove.isPending || download.isPending;
  const error = remove.isError ? toAppError(remove.error).code === 'CONFLICT' ? 'This memory changed. Review it before deleting.' : toAppError(remove.error).message
    : download.isError ? 'We could not download this photo. Try again.' : '';
  if (query.isPending) return <Status>Loading memory…</Status>;
  if (query.isError) return <RouteErrorPage title="Memory" returnTo="/memories" returnLabel="Return to memories" error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.state !== 'published') return <RouteErrorPage title="Memory" returnTo="/memories" returnLabel="Return to memories" />;
  const memory = query.data; const author = memory.createdBy === account!.id;
  const member = pair?.status === 'active' ? pair.members.find(item => item.userId === memory.createdBy) : undefined;
  // The author edits the date below, so the title names the page. The partner sees the date as the title.
  // A caption can hold 1000 characters, so it reads as body text with its line breaks.
  return <>{author ? <PageHeader title="Edit memory" />
    : <PageHeader title={formatDate(DateTime.fromISO(memory.memoryDate), 'date', account!.locale)} description={member && <PartnerBadge name={member.displayName} slot={member.slot} />} />}
    <section className="card memory-detail">{memory.photos.map((photo, index) => <figure key={photo.id}><div className="memory-photo" style={{ aspectRatio: photo.width + ' / ' + photo.height }}><MemoryImage photo={photo} variant="full" alt={(memory.caption ? memory.caption + ' · ' : '') + 'Photo ' + (index + 1)} /></div><figcaption><Button variant="text" disabled={busy} onClick={() => download.mutate({ path: photo.fullPath, index })}>Download photo {index + 1}</Button></figcaption></figure>)}
      {author ? <MemoryEditor key={memory.id} memory={memory} /> : memory.caption && <p className="memory-caption preserve-lines">{memory.caption}</p>}
      {author && <div className="actions"><Button variant="secondary" disabled={busy} onClick={() => setConfirm(true)}>{remove.isError ? 'Retry deletion' : 'Delete memory'}</Button></div>}{error && <Status error>{error}</Status>}
    </section><Dialog busy={remove.isPending} open={confirm} title="Delete this memory?" onClose={() => setConfirm(false)}><p>Both partners will lose this memory and its photos.</p><Button variant="danger" disabled={busy} onClick={() => remove.mutate(memory.version)}>Confirm deletion</Button></Dialog>
  </>;
}
// The author changes the date and caption here. Photos stay as published.
function MemoryEditor({ memory }: { memory: Memory }) {
  // Keep the version the draft started from. A concurrent edit then fails with CONFLICT.
  const [version, setVersion] = useState(memory.version);
  const command = useCommandId();
  const form = useForm<MemoryInput>({ defaultValues: { caption: memory.caption, memoryDate: memory.memoryDate } });
  const reset = (current: Memory) => { form.reset({ caption: current.caption, memoryDate: current.memoryDate }); setVersion(current.version); };
  const save = useMutation({
    mutationFn: (values: MemoryInput) => {
      const parsed = memoryInputSchema.safeParse(values);
      if (!parsed.success) throw new AppError({ code: 'VALIDATION', message: parsed.error.issues[0].message });
      return updateMemory(memory.id, parsed.data, version, command.idFor({ input: parsed.data, version }));
    },
    onSuccess: saved => { command.reset(); reset(saved); },
  });
  const reload = useMutation({ mutationFn: () => getMemory(memory.pairId, memory.id), onSuccess: current => { reset(current); save.reset(); } });
  const failure = save.isError ? toAppError(save.error) : null;
  const conflict = failure?.code === 'CONFLICT';
  const error = reload.isError ? 'We could not reload this memory.' : conflict ? 'This memory changed. Your draft is kept.' : failure?.message ?? '';
  const saving = save.isPending || reload.isPending;
  useUnsavedChanges(form.formState.isDirty);
  return <form className="memory-edit" onSubmit={form.handleSubmit(values => save.mutate(values))}>
    <fieldset disabled={saving}>
      <label className="field"><span>Memory date</span><input type="date" autoComplete="off" required {...form.register('memoryDate')} /></label>
      <label className="field"><span>Caption</span><textarea rows={4} maxLength={1000} autoComplete="off" {...form.register('caption')} /></label>
    </fieldset>
    {error && <Status error>{error}</Status>}
    {save.isSuccess && !form.formState.isDirty && <p role="status">Changes saved.</p>}
    {conflict && <Button variant="secondary" type="button" disabled={saving} onClick={() => reload.mutate()}>Reload memory and discard draft</Button>}
    <div className="actions"><Button variant="primary" type="submit" disabled={saving || conflict}>{save.isPending ? 'Saving…' : failure ? 'Retry save' : 'Save changes'}</Button></div>
  </form>;
}
