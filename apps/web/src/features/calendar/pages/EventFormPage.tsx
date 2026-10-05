import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { eventFormSchema, eventToForm, toEventInput, type Event, type EventFormValues, type EventInput } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { captureQueryScope } from '../../../lib/query-client';
import { useNetworkStatus } from '../../../lib/network';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { Dialog } from '../../../components/ui/Dialog';
import { calendarKeys, getEvent } from '../queries';
import { createEvent, updateEvent } from '../commands';
import { EventFields } from '../components/EventFields';
import '../../../styles/calendar.css';
type Draft = { values: EventFormValues; id: string; commandId: string; expectedVersion?: number; frozen: boolean; dirty: boolean; submission?: EventInput };
export function EventFormPage() {
  const { account, pair } = useSession(); const { eventId } = useParams();
  const query = useQuery({ queryKey: calendarKeys.event(account!.id, pair?.status === 'active' ? pair.pairId : '', eventId ?? 'new'), queryFn: () => getEvent(pair?.status === 'active' ? pair.pairId : '', eventId!), enabled: Boolean(eventId && pair?.status === 'active') });
  if (!account || pair?.status !== 'active') return null;
  if (eventId && query.isPending) return <Status>Loading event…</Status>;
  if (eventId && query.isError) return <><Status error>We could not load this event.</Status><Button onClick={() => void query.refetch()}>Retry</Button></>;
  if (eventId && !query.data) return <section className="card"><h1>Event unavailable</h1><Link to="/calendar">Return to calendar</Link></section>;
  return <EventEditor key={eventId ?? 'new'} event={query.data ?? undefined} />;
}
function EventEditor({ event }: { event?: Event }) {
  const { account, pair } = useSession(); const navigate = useNavigate(); const [params] = useSearchParams(); const online = useNetworkStatus();
  if (!account || pair?.status !== 'active') throw new Error('Active pair required');
  const key = 'event:' + (event?.id ?? 'new');
  const initial = useRef(readDraft<Draft>(account.id, pair.pairId, key));
  const identity = useRef({ id: initial.current?.id ?? event?.id ?? crypto.randomUUID(), commandId: initial.current?.commandId ?? crypto.randomUUID(), expectedVersion: initial.current?.expectedVersion ?? event?.version });
  const submission = useRef(initial.current?.submission);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [conflict, setConflict] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const [frozen, setFrozen] = useState(initial.current?.frozen ?? false); const [sharing, setSharing] = useState<EventFormValues | null>(null);
  const now = useRef(DateTime.now().setZone(account.timezone));
  const date = DateTime.fromISO(params.get('date') ?? '');
  const form = useForm<EventFormValues>({ resolver: zodResolver(eventFormSchema), defaultValues: initial.current?.values ?? (event ? eventToForm(event) : { title: '', allDay: false, startDate: date.isValid ? date.toISODate()! : now.current.toISODate()!, endDate: date.isValid ? date.toISODate()! : now.current.toISODate()!, startTime: '18:00', endTime: '19:00', timezone: account.timezone, owner: 'together', visibility: 'shared', location: '', description: '', repeat: 'none', importantDate: false }) });
  const dirty = !confirmed && (form.formState.isDirty || initial.current?.dirty === true || frozen);
  useUnsavedChanges(dirty);
  useEffect(() => {
    const subscription = form.watch(values => writeDraft(account.id, pair.pairId, key, { ...identity.current, values, frozen, dirty: true, submission: submission.current }));
    return () => subscription.unsubscribe();
  }, [form, account.id, pair.pairId, key, frozen]);
  useEffect(() => { if (confirmed) navigate('/events/' + identity.current.id, { replace: true }); }, [confirmed, navigate]);
  async function save(values: EventFormValues, confirmShared = false) {
    const scope = captureQueryScope(); setSaving(true); setError('');
    const input = submission.current ?? toEventInput({ ...values, id: identity.current.id, pairId: pair!.status === 'active' ? pair!.pairId : '', confirmShared });
    submission.current = input;
    writeDraft(account!.id, input.pairId, key, { ...identity.current, values, frozen: true, dirty: true, submission: input });
    const result = event ? await updateEvent(event.id, input, identity.current.expectedVersion!, identity.current.commandId) : await createEvent(input, identity.current.commandId);
    try { scope.assertCurrent(); } catch { setSaving(false); setFrozen(true); setError('Your save is unconfirmed. Retry with the same details.'); return; }
    setSaving(false);
    if (result.ok) { removeDraft(account!.id, input.pairId, key); setConfirmed(true); return; }
    if (result.error.code === 'CONFLICT') { setError('This event changed. Your draft is kept.'); setConflict(true); setFrozen(false); submission.current = undefined; identity.current.commandId = crypto.randomUUID(); }
    else { setError(result.error.message ?? 'Save failed. Try again.'); setFrozen(result.error.code === 'RETRYABLE'); if (result.error.code !== 'RETRYABLE') { identity.current.commandId = crypto.randomUUID(); submission.current = undefined; } }
    writeDraft(account!.id, input.pairId, key, { ...identity.current, values, frozen: result.error.code === 'RETRYABLE', dirty: true, submission: submission.current });
  }
  const names = { a: pair.members.find(member => member.slot === 'a')!.displayName, b: pair.members.find(member => member.slot === 'b')!.displayName, together: 'Together' };
  const slot = pair.members.find(member => member.userId === account.id)!.slot;
  return <><PageHeader title={event ? 'Edit event' : 'Add event'} description={event ? 'Keep the details up to date.' : 'Plan time for yourself or together.'} /><section className="card form-page"><form onSubmit={form.handleSubmit(values => { if (event?.visibility === 'private' && values.visibility === 'shared') setSharing(values); else void save(values); })}><EventFields form={form} names={names} slot={slot} author={!event || event.authorId === account.id} locked={saving || frozen} />{error && <Status error>{error}</Status>}{frozen && <p>Your save is unconfirmed. Retry with the same details.</p>}{conflict && <Button type="button" variant="secondary" onClick={async () => { const current = await getEvent(pair.pairId, event!.id); if (!current) { setError('Event unavailable.'); return; } form.reset(eventToForm(current)); submission.current = undefined; identity.current.expectedVersion = current.version; identity.current.commandId = crypto.randomUUID(); initial.current = undefined; setConflict(false); setError(''); removeDraft(account.id, pair.pairId, key); }}>Reload event and discard draft</Button>}<div className="actions"><Button disabled={!online || saving || conflict} type="submit">{saving ? 'Saving…' : frozen ? 'Retry save' : event ? 'Save changes' : 'Save event'}</Button><Link to="/calendar">Cancel</Link></div></form></section><Dialog open={Boolean(sharing)} title="Share this event?" onClose={() => setSharing(null)}><p>Your partner will see this event.</p><Button onClick={() => { const values = sharing!; setSharing(null); void save(values, true); }}>Share event</Button></Dialog></>;
}
