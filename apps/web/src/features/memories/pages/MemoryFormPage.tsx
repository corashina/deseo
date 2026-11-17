import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { DateTime } from 'luxon';
import { Link, useNavigate } from 'react-router-dom';
import { AppError, toAppError } from '@deseo/domain/result';
import { memoryInputSchema, type Memory, type MemoryInput } from '@deseo/domain/memories';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { reserveMemory, publishMemory } from '../commands';
import { preparePhoto, reservationInput, type PreparedBrowserPhoto, type MemoryReservationInput } from '../prepare';
import { PhotoSelection } from '../components/PhotoSelection';
import '../../../styles/memories.css';
type Upload = { key: string; input: MemoryReservationInput; reserveId: string; finalizeId: string };
export function MemoryFormPage() {
  const { account, pair } = useSession(); if (!account || pair?.status !== 'active') throw new Error('Active pair required');
  const navigate = useNavigate();
  // One upload per submitted input. A retry of the same input reuses its memory, photo, and command IDs.
  const upload = useRef<Upload>(undefined);
  const [photos, setPhotos] = useState<PreparedBrowserPhoto[]>([]);
  const [progress, setProgress] = useState('');
  const form = useForm<MemoryInput>({ defaultValues: { caption: '', memoryDate: DateTime.now().setZone(account.timezone).toISODate()! } });
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
      if (!photos.length) throw new AppError({ code: 'VALIDATION', message: 'Choose at least one photo.' });
      const key = JSON.stringify([parsed.data, photos.map(photo => photo.id)]);
      if (upload.current?.key !== key) upload.current = { key, input: reservationInput(pair.pairId, parsed.data, photos), reserveId: crypto.randomUUID(), finalizeId: crypto.randomUUID() };
      const { input, reserveId, finalizeId } = upload.current;
      setProgress('Reserving photo space…');
      const reservation = await reserveMemory(input, reserveId);
      return reservation.state === 'published' ? reservation : publishMemory(reservation, photos, finalizeId, setProgress);
    },
    onSuccess: () => { upload.current = undefined; },
    onSettled: () => setProgress(''),
  });
  const failure = save.isError ? toAppError(save.error) : null;
  const error = failure?.message ?? (prepare.isError ? prepare.error.message : '');
  const saving = save.isPending;
  useUnsavedChanges(!save.isSuccess && (form.formState.isDirty || photos.length > 0));
  useEffect(() => {
    if (save.data) navigate('/memories/' + save.data.id, { replace: true });
  }, [save.data, navigate]);
  return <><PageHeader title="Add memory" />
    <section className="card form-page memory-form"><form onSubmit={form.handleSubmit(values => save.mutate(values))}>
      <PhotoSelection photos={photos} disabled={saving} preparing={prepare.isPending} onSelect={files => { if (files.length) prepare.mutate(files); }} onRemove={photoId => setPhotos(current => current.filter(photo => photo.id !== photoId))} progress={progress} />
      <fieldset disabled={saving || prepare.isPending}>
        <label className="field"><span>Memory date</span><input type="date" autoComplete="off" required {...form.register('memoryDate')} /></label>
        <label className="field"><span>Caption</span><textarea rows={4} maxLength={1000} autoComplete="off" {...form.register('caption')} /></label>
      </fieldset>
      {error && <Status error>{error}</Status>}
      <div className="actions"><Button variant="primary" type="submit" disabled={saving || prepare.isPending}>{saving ? 'Saving…' : failure ? 'Retry save' : 'Publish memory'}</Button><Link to="/memories">Cancel</Link></div>
    </form></section></>;
}
