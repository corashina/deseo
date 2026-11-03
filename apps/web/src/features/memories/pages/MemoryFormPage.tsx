import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { DateTime } from 'luxon';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { memoryInputSchema, type Memory, type MemoryInput } from '@deseo/domain/memories';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { useNetworkStatus } from '../../../lib/network';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { getMemory, memoryKeys } from '../queries';
import { reserveMemory, uploadMemoryPhoto, finalizeMemory, updateMemory, deleteMemory } from '../commands';
import { preparePhoto, reservationInput, type PreparedBrowserPhoto, type MemoryReservationInput } from '../prepare';
import { PhotoSelection } from '../components/PhotoSelection';
import '../../../styles/memories.css';
type Attempt = { input: MemoryReservationInput; commandId: string; publishId: string; version?: number; discardId: string; reserved?: boolean; discardVersion?: number };
type Draft = { values: MemoryInput; photos: PreparedBrowserPhoto[]; id: string; version?: number; attempt?: Attempt; dirty: boolean };
export function MemoryFormPage() {
  const { memoryId } = useParams(); const { account, pair } = useSession(); const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({ queryKey: memoryKeys.detail(account!.id, pairId, memoryId ?? 'new'), queryFn: () => getMemory(pairId, memoryId!), enabled: Boolean(memoryId), retry: false });
  if (memoryId && query.isPending) return <Status>Loading memory…</Status>;
  if (memoryId && query.isError) return <RouteErrorPage title="Memory" returnTo="/memories" returnLabel="Return to memories" error={query.error} onRetry={() => void query.refetch()} />;
  if (memoryId && ( !query.data || query.data.createdBy !== account!.id || query.data.state !== 'published')) return <RouteErrorPage title="Memory" returnTo="/memories" returnLabel="Return to memories" />;
  return <MemoryEditor key={memoryId ?? 'new'} memory={query.data} />;
}
function MemoryEditor({ memory }: { memory?: Memory }) {
  const { account, pair } = useSession(); if (!account || pair?.status !== 'active') throw new Error('Active pair required');
  const accountId = account.id; const pairId = pair.pairId; const key = 'memory:' + (memory?.id ?? 'new');
  const stored = useRef(readDraft<Draft>(accountId, pairId, key));
  const id = useRef(stored.current?.id ?? memory?.id ?? crypto.randomUUID());
  const version = useRef(stored.current?.version ?? memory?.version);
  const attempt = useRef(stored.current?.attempt); const mounted = useRef(false); const busy = useRef(false);
  const [photos, setPhotos] = useState(stored.current?.photos ?? []);
  const [saving, setSaving] = useState(false); const [preparing, setPreparing] = useState(false);
  const [frozen, setFrozen] = useState(Boolean(attempt.current)); const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false); const [confirmed, setConfirmed] = useState(false); const [progress, setProgress] = useState('');
  const online = useNetworkStatus(); const navigate = useNavigate();
  const form = useForm<MemoryInput>({ defaultValues: stored.current?.values ?? (memory ? { caption: memory.caption, memoryDate: memory.memoryDate } : { caption: '', memoryDate: DateTime.now().setZone(pair.timezone).toISODate()! }) });
  const keep = (values = form.getValues(), currentPhotos = photos) => writeDraft(accountId, pairId, key, { values, photos: currentPhotos, id: id.current, version: version.current, attempt: attempt.current, dirty: true } satisfies Draft);
  useUnsavedChanges(!confirmed && (form.formState.isDirty || photos.length > 0 || stored.current?.dirty === true || frozen));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { const subscription = form.watch(values => writeDraft(accountId, pairId, key, { values, photos, id: id.current, version: version.current, attempt: attempt.current, dirty: true })); return () => subscription.unsubscribe(); }, [form, photos, accountId, pairId, key]);
  useEffect(() => { if (confirmed) navigate('/memories/' + id.current, { replace: true }); }, [confirmed, navigate]);
  const beginScope = useCommandScope(() => { busy.current = false; setSaving(false); setPreparing(false); setProgress(''); });
  async function select(files: File[]) {
    if (busy.current || frozen || !files.length) return;
    if (photos.length + files.length > 5) { setError('Choose no more than five photos.'); return; }
    const scope = beginScope(); busy.current = true; setPreparing(true); setError('');
    const prepared: PreparedBrowserPhoto[] = [];
    try {
      for (const file of files) prepared.push(await preparePhoto(file, scope.signal));
      scope.assertCurrent(); if (!mounted.current) return;
      const next = [...photos, ...prepared]; setPhotos(next); keep(form.getValues(), next);
    } catch (failure) { if (mounted.current && !scope.signal.aborted) setError(failure instanceof Error ? failure.message : 'Choose another photo.'); }
    finally { if (mounted.current && !scope.signal.aborted) { busy.current = false; setPreparing(false); } }
  }
  async function save(values: MemoryInput) {
    if (!online || busy.current || conflict || attempt.current?.discardVersion !== undefined) return;
    const parsed = memoryInputSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (!memory && !photos.length) { setError('Choose at least one photo.'); return; }
    const next: Attempt = attempt.current ?? { input: reservationInput(id.current, pairId, parsed.data, photos), commandId: crypto.randomUUID(), publishId: crypto.randomUUID(), discardId: crypto.randomUUID(), version: version.current };
    // Persist immutable command, input, version, and prepared bytes before the first await.
    attempt.current = next; keep(values); const scope = beginScope();
    busy.current = true; setSaving(true); setFrozen(true); setError(''); setProgress(memory ? 'Saving changes…' : 'Reserving photo space…');
    let result = memory ? await updateMemory(memory.id, next.input, next.version!, next.commandId) : await reserveMemory(next.input, next.commandId);
    if (!mounted.current || scope.signal.aborted) return;
    if (result.ok && !memory && result.data.state !== 'published') {
      next.reserved = true; keep(values);
      const reservation = result.data;
      for (let index = 0; index < photos.length; index++) {
        setProgress('Uploading photo ' + (index + 1) + ' of ' + photos.length + '…');
        const uploaded = await uploadMemoryPhoto(reservation, photos[index]);
        if (!mounted.current || scope.signal.aborted) return;
        if (!uploaded.ok) { result = uploaded; break; }
      }
      if (result.ok) { setProgress('Publishing memory…'); result = await finalizeMemory(next.input.id, next.publishId); }
    }
    if (!mounted.current || scope.signal.aborted) return;
    busy.current = false; setSaving(false); setProgress('');
    if (result.ok) { removeDraft(accountId, pairId, key); setConfirmed(true); return; }
    setConflict(result.error.code === 'CONFLICT');
    setError(result.error.code === 'CONFLICT' ? 'This memory changed. Your draft is kept.' : result.error.message ?? 'Upload failed. Your photos, date, and caption are kept.');
    // A failed upload retains its reservation. Retry inspects immutable files before sending them again.
    const rejectedReservation = !memory && !next.reserved
      && ['QUOTA_EXCEEDED', 'VALIDATION'].includes(result.error.code);
    if (rejectedReservation || memory && result.error.code !== 'RETRYABLE') {
      attempt.current = undefined; setFrozen(false); keep(values);
    }
  }
  async function discardUpload() {
    if (!attempt.current || busy.current || !online) return;
    const next = attempt.current; const scope = beginScope(); busy.current = true; setSaving(true);
    if (next.discardVersion === undefined) {
      let current: Memory;
      try { current = await getMemory(pairId, next.input.id); }
      catch { if (mounted.current && !scope.signal.aborted) { busy.current = false; setSaving(false); setError('Retry the upload before changing photos.'); } return; }
      if (!mounted.current || scope.signal.aborted) return;
      if (current.state === 'published') { removeDraft(accountId, pairId, key); setConfirmed(true); return; }
      // Persist the deletion version before sending a command that can hide its own row.
      next.discardVersion = current.version; keep();
    }
    const result = await deleteMemory(next.input.id, next.discardVersion, next.discardId);
    if (!mounted.current || scope.signal.aborted) return;
    busy.current = false; setSaving(false);
    if (!result.ok) {
      if (result.error.code === 'CONFLICT') {
        // Deletion did not commit. Read the current state before the next discard.
        next.discardVersion = undefined; next.discardId = crypto.randomUUID(); keep();
        setError('This memory changed. Retry the discard.');
      } else setError('We could not confirm the discard. Retry the discard.');
      return;
    }
    // Deleted reservations keep their globally unique photo IDs until cleanup finishes.
    const nextPhotos = photos.map(photo => ({ ...photo, id: crypto.randomUUID() }));
    attempt.current = undefined; id.current = crypto.randomUUID(); setPhotos(nextPhotos);
    setFrozen(false); setConflict(false); setError(''); keep(form.getValues(), nextPhotos);
  }
  async function reload() {
    if (!memory || busy.current) return;
    const scope = beginScope(); busy.current = true; setSaving(true);
    try {
      const current = await getMemory(pairId, memory.id); scope.assertCurrent(); if (!mounted.current) return;
      version.current = current.version; attempt.current = undefined; stored.current = undefined;
      form.reset({ caption: current.caption, memoryDate: current.memoryDate }); removeDraft(accountId, pairId, key); setFrozen(false); setConflict(false); setError('');
    } catch { if (mounted.current && !scope.signal.aborted) setError('We could not reload this memory.'); }
    finally { if (mounted.current && !scope.signal.aborted) { busy.current = false; setSaving(false); } }
  }
  return <><PageHeader title={memory ? 'Edit memory' : 'Add memory'} />
    <section className="card form-page memory-form"><form onSubmit={form.handleSubmit(save)}><fieldset disabled={saving || frozen || preparing}>
      <label className="field"><span>Memory date</span><input type="date" required {...form.register('memoryDate')} /></label>
      <label className="field"><span>Caption</span><textarea rows={4} maxLength={1000} {...form.register('caption')} /></label>
    </fieldset>{!memory && <PhotoSelection photos={photos} disabled={saving || frozen} preparing={preparing} onSelect={files => void select(files)} onRemove={photoId => { const next = photos.filter(photo => photo.id !== photoId); setPhotos(next); keep(form.getValues(), next); }} progress={progress} />}
      {memory && <p role="status">{progress}</p>}{error && <Status error>{error}</Status>}
      {frozen && !saving && <p>{attempt.current?.discardVersion !== undefined ? 'The discard is unconfirmed. Retry the discard.' : 'Your upload is unconfirmed. Retry with the same photos and details.'}</p>}
      {conflict && memory && <Button variant="secondary" onClick={() => void reload()}>Reload memory and discard draft</Button>}
      {frozen && !memory && !saving && <Button variant="secondary" disabled={!online} onClick={() => void discardUpload()}>Discard upload and change photos</Button>}
      <div className="actions"><Button type="submit" disabled={!online || saving || preparing || conflict || attempt.current?.discardVersion !== undefined}>{saving ? 'Saving…' : frozen ? 'Retry save' : memory ? 'Save changes' : 'Publish memory'}</Button><Link to="/memories">Cancel</Link></div>
    </form></section></>;
}
