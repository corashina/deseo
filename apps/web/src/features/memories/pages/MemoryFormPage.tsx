import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { Link, useNavigate } from 'react-router-dom';
import { toAppError } from '@deseo/domain/result';
import { memoryInputSchema, type Memory, type MemoryInput } from '@deseo/domain/memories';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { reserveMemory, publishMemory } from '../commands';
import { preparePhoto, reservationInput, type PreparedBrowserPhoto, type MemoryReservationInput } from '../prepare';
import { PhotoSelection } from '../components/PhotoSelection';
import { MemoryFields } from '../components/MemoryFields';
import '../../../styles/memories.css';
type Upload = { key: string; input: MemoryReservationInput; reserveId: string; finalizeId: string };
export function MemoryFormPage() {
  const { account, pair } = useSession(); if (!account || pair?.status !== 'active') throw new Error('Active pair required');
  const navigate = useNavigate();
  // One upload per submitted input. A retry of the same input reuses its memory, photo, and command IDs.
  const upload = useRef<Upload>(undefined);
  const [photos, setPhotos] = useState<PreparedBrowserPhoto[]>([]);
  const [progress, setProgress] = useState('');
  const [photoError, setPhotoError] = useState('');
  const page = useRef<HTMLFormElement>(null);
  const form = useForm<MemoryInput>({ resolver: zodResolver(memoryInputSchema), defaultValues: { caption: '', memoryDate: DateTime.now().setZone(account.timezone).toISODate()! } });
  const prepare = useMutation({
    mutationFn: async (files: File[]) => {
      if (photos.length + files.length > 5) throw new Error('Choose no more than 5 photos.');
      const prepared: PreparedBrowserPhoto[] = [];
      for (const file of files) prepared.push(await preparePhoto(file));
      return prepared;
    },
    onSuccess: prepared => { setPhotoError(''); setPhotos(current => [...current, ...prepared]); },
  });
  const save = useMutation({
    mutationFn: async (values: MemoryInput): Promise<Memory> => {
      const key = JSON.stringify([values, photos.map(photo => photo.id)]);
      if (upload.current?.key !== key) upload.current = { key, input: reservationInput(pair.pairId, values, photos), reserveId: crypto.randomUUID(), finalizeId: crypto.randomUUID() };
      const { input, reserveId, finalizeId } = upload.current;
      setProgress('Reserving photo space…');
      const reservation = await reserveMemory(input, reserveId);
      return reservation.state === 'published' ? reservation : publishMemory(reservation, photos, finalizeId, setProgress);
    },
    onSuccess: () => { upload.current = undefined; },
    onSettled: () => setProgress(''),
  });
  const failure = save.isError ? toAppError(save.error) : null;
  const saving = save.isPending;
  useUnsavedChanges(!save.isSuccess && (form.formState.isDirty || photos.length > 0));
  useEffect(() => {
    if (save.data) navigate('/memories/' + save.data.id, { replace: true });
  }, [save.data, navigate]);
  // A missing photo shows its error beside the picker. When the other fields are valid, focus moves to the picker.
  const missingPhoto = () => { if (!photos.length) setPhotoError('Choose at least one photo.'); return !photos.length; };
  const submit = form.handleSubmit(values => {
    if (!missingPhoto()) save.mutate(values);
    else page.current?.querySelector<HTMLInputElement>('input[name=photos]')?.focus();
  }, missingPhoto);
  return <><PageHeader title="Add memory" />
    <section className="card form-page memory-form"><form ref={page} onSubmit={event => void submit(event)}>
      <PhotoSelection photos={photos} disabled={saving} preparing={prepare.isPending} onSelect={files => { if (files.length) prepare.mutate(files); }} onRemove={photoId => setPhotos(current => current.filter(photo => photo.id !== photoId))} progress={progress} error={photoError || (prepare.isError ? prepare.error.message : '')} />
      <fieldset disabled={saving || prepare.isPending}>
        <MemoryFields form={form} />
      </fieldset>
      {failure && <Status error>{failure.message}</Status>}
      <div className="actions"><Button variant="primary" type="submit" disabled={saving || prepare.isPending}>{saving ? 'Saving…' : failure ? 'Retry save' : 'Publish memory'}</Button><Link className="button secondary" to="/memories">Cancel</Link></div>
    </form></section></>;
}
