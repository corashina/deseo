import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { DateTime } from 'luxon';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppError, toAppError } from '@deseo/domain/result';
import { memoryInputSchema, type Memory, type MemoryInput } from '@deseo/domain/memories';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { useCommandId } from '../../../lib/command-id';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { getMemory, memoryKeys } from '../queries';
import { reserveMemory, publishMemory, updateMemory } from '../commands';
import { preparePhoto, reservationInput, type PreparedBrowserPhoto, type MemoryReservationInput } from '../prepare';
import { PhotoSelection } from '../components/PhotoSelection';
import { MemoryImage } from '../components/MemoryImage';
import { memoryTitle } from '../title';
import '../../../styles/memories.css';
type Upload = { key: string; input: MemoryReservationInput; reserveId: string; finalizeId: string };
export function MemoryFormPage() {
  const { memoryId } = useParams(); const { account, pair } = useSession(); const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({ queryKey: memoryKeys.detail(account!.id, pairId, memoryId ?? 'new'), queryFn: () => getMemory(pairId, memoryId!), enabled: Boolean(memoryId), retry: false });
  if (memoryId && query.isPending) return <Status>Loading memory…</Status>;
  if (memoryId && query.isError) return <RouteErrorPage title="Memory" returnTo="/memories" returnLabel="Return to memories" error={query.error} onRetry={() => void query.refetch()} />;
  if (memoryId && (!query.data || query.data.createdBy !== account!.id || query.data.state !== 'published')) return <RouteErrorPage title="Memory" returnTo="/memories" returnLabel="Return to memories" />;
  return <MemoryEditor key={memoryId ?? 'new'} memory={query.data} />;
}
function MemoryEditor({ memory }: { memory?: Memory }) {
  const { account, pair } = useSession(); if (!account || pair?.status !== 'active') throw new Error('Active pair required');
  const navigate = useNavigate();
  // Keep the version the draft started from. A concurrent edit then fails with CONFLICT.
  const [version, setVersion] = useState(memory?.version);
  const command = useCommandId();
  // One upload per submitted input. A retry of the same input reuses its memory, photo, and command IDs.
  const upload = useRef<Upload>(undefined);
  const [photos, setPhotos] = useState<PreparedBrowserPhoto[]>([]);
  const [progress, setProgress] = useState('');
  const form = useForm<MemoryInput>({ defaultValues: memory ? { caption: memory.caption, memoryDate: memory.memoryDate } : { caption: '', memoryDate: DateTime.now().setZone(pair.timezone).toISODate()! } });
  const prepare = useMutation({
    mutationFn: async (files: File[]) => {
      if (photos.length + files.length > 5) throw new Error('Choose no more than 5 photos.');
      const prepared: PreparedBrowserPhoto[] = [];
      for (const file of files) prepared.push(await preparePhoto(file));
      return prepared;
    },
    onSuccess: prepared => setPhotos(current => [...current, ...prepared]),
  });
  const save = useMutation({
    mutationFn: async (values: MemoryInput): Promise<Memory> => {
      const parsed = memoryInputSchema.safeParse(values);
      if (!parsed.success) throw new AppError({ code: 'VALIDATION', message: parsed.error.issues[0].message });
      if (memory) {
        setProgress('Saving changes…');
        return updateMemory(memory.id, parsed.data, version!, command.idFor({ input: parsed.data, version }));
      }
      if (!photos.length) throw new AppError({ code: 'VALIDATION', message: 'Choose at least one photo.' });
      const key = JSON.stringify([parsed.data, photos.map(photo => photo.id)]);
      if (upload.current?.key !== key) upload.current = { key, input: reservationInput(pair.pairId, parsed.data, photos), reserveId: crypto.randomUUID(), finalizeId: crypto.randomUUID() };
      const { input, reserveId, finalizeId } = upload.current;
      setProgress('Reserving photo space…');
      const reservation = await reserveMemory(input, reserveId);
      return reservation.state === 'published' ? reservation : publishMemory(reservation, photos, finalizeId, setProgress);
    },
    onSuccess: () => { command.reset(); upload.current = undefined; },
    onSettled: () => setProgress(''),
  });
  const reload = useMutation({
    mutationFn: async () => {
      const current = await getMemory(pair.pairId, memory!.id);
      form.reset({ caption: current.caption, memoryDate: current.memoryDate });
      setVersion(current.version);
    },
    onSuccess: () => save.reset(),
  });
  const failure = save.isError ? toAppError(save.error) : null;
  const conflict = Boolean(memory) && failure?.code === 'CONFLICT';
  const error = reload.isError ? 'We could not reload this memory.' : conflict ? 'This memory changed. Your draft is kept.'
    : failure?.message ?? (prepare.isError ? prepare.error.message : '');
  const saving = save.isPending || reload.isPending;
  useUnsavedChanges(!save.isSuccess && (form.formState.isDirty || photos.length > 0));
  useEffect(() => {
    if (save.data) navigate('/memories/' + save.data.id, { replace: true });
  }, [save.data, navigate]);
  return <><PageHeader title={memory ? 'Edit memory' : 'Add memory'} description={memory ? 'Change the date or caption.' : 'Keep a moment with photos, a date, and a caption.'} />
    <section className="card form-page memory-form"><form onSubmit={form.handleSubmit(values => save.mutate(values))}>
      {memory ? <div className="field"><span>Photos</span><div className="photo-selection-grid">{memory.photos.map(photo => <div key={photo.id} className="memory-cover"><MemoryImage photo={photo} alt={memoryTitle(memory)} /></div>)}</div><p className="field-hint">Photos stay as published.</p></div>
        : <PhotoSelection photos={photos} disabled={saving} preparing={prepare.isPending} onSelect={files => { if (files.length) prepare.mutate(files); }} onRemove={photoId => setPhotos(current => current.filter(photo => photo.id !== photoId))} progress={progress} />}
      <fieldset disabled={saving || prepare.isPending}>
      <label className="field"><span>Memory date</span><input type="date" autoComplete="off" required {...form.register('memoryDate')} /></label>
      <label className="field"><span>Caption</span><textarea rows={4} maxLength={1000} autoComplete="off" {...form.register('caption')} /></label>
    </fieldset>
      {memory && <p role="status">{progress}</p>}{error && <Status error>{error}</Status>}
      {conflict && <Button variant="secondary" disabled={saving} onClick={() => reload.mutate()}>Reload memory and discard draft</Button>}
      <div className="actions"><Button variant="primary" type="submit" disabled={saving || prepare.isPending || conflict}>{saving ? 'Saving…' : failure ? 'Retry save' : memory ? 'Save changes' : 'Publish memory'}</Button><Link to="/memories">Cancel</Link></div>
    </form></section></>;
}
