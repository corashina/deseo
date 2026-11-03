import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { getDateIdea, ideaKeys, planDateIdea, type DateIdea } from '../ideas';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { eventFormSchema, eventToForm, toEventInput, type Event, type EventFormValues, type EventInput } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
import { useNetworkStatus } from '../../../lib/network';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { Dialog } from '../../../components/ui/Dialog';
import { calendarKeys, getEvent } from '../queries';
import { createEvent, updateEvent } from '../commands';
import { EventFields } from '../components/EventFields';
import '../../../styles/calendar.css';

type Draft = {
  values: EventFormValues; id: string; commandId: string; expectedVersion?: number; ideaVersion?: number;
  frozen: boolean; dirty: boolean; submission?: EventInput;
};

export function EventFormPage() {
  const { account, pair } = useSession();
  const { eventId } = useParams();
  const [params] = useSearchParams();
  const ideaId = params.get('idea');
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({
    queryKey: calendarKeys.event(account!.id, pairId, eventId ?? 'new'),
    queryFn: () => getEvent(pairId, eventId!),
    enabled: Boolean(eventId && pairId),
  });
  const idea = useQuery({ queryKey: ideaKeys.detail(account!.id, pairId, ideaId ?? 'none'), queryFn: () => getDateIdea(pairId, ideaId!), enabled: Boolean(ideaId) });
  if (!account || pair?.status !== 'active') return null;
  if (ideaId && idea.isPending) return <Status>Loading idea…</Status>;
  if (ideaId && idea.isError) return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" error={idea.error} onRetry={() => void idea.refetch()} />;
  if (ideaId && !idea.data) return <RouteErrorPage title="Idea" returnTo="/ideas" returnLabel="Return to ideas" />;
  if (eventId && query.isPending) return <Status>Loading event…</Status>;
  if (eventId && query.isError) {
    return <RouteErrorPage title="Event" returnTo="/calendar" returnLabel="Return to calendar" error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (eventId && !query.data) {
    return <RouteErrorPage title="Event" returnTo="/calendar" returnLabel="Return to calendar" />;
  }
  return <EventEditor key={eventId ?? ideaId ?? 'new'} event={query.data ?? undefined} idea={idea.data ?? undefined} />;
}

function EventEditor({ event, idea }: { event?: Event; idea?: DateIdea }) {
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const online = useNetworkStatus();

  if (!account || pair?.status !== 'active') throw new Error('Active pair required');
  const key = 'event:' + (event?.id ?? (idea ? 'idea:' + idea.id : 'new'));
  const initial = useRef(readDraft<Draft>(account.id, pair.pairId, key));
  const identity = useRef({
    id: initial.current?.id ?? event?.id ?? crypto.randomUUID(),
    commandId: initial.current?.commandId ?? crypto.randomUUID(),
    expectedVersion: initial.current?.expectedVersion ?? event?.version, ideaVersion: initial.current?.ideaVersion ?? idea?.version,
  });
  const submission = useRef(initial.current?.submission);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const beginScope = useCommandScope(() => { setSaving(false); });
  const [frozen, setFrozen] = useState(initial.current?.frozen ?? false);
  const [sharing, setSharing] = useState<EventFormValues | null>(null);
  const now = useRef(DateTime.now().setZone(account.timezone));
  const date = DateTime.fromISO(params.get('date') ?? '');
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: initial.current?.values ?? (event ? eventToForm(event) : {
      title: idea?.title ?? '', allDay: false,
      startDate: date.isValid ? date.toISODate()! : now.current.toISODate()!,
      endDate: date.isValid ? date.toISODate()! : now.current.toISODate()!,
      startTime: '18:00', endTime: '19:00', timezone: account.timezone,
      owner: 'together', visibility: 'shared', location: '', description: idea?.note ?? '', repeat: 'none', importantDate: false,
    }),
  });
  const dirty = !confirmed && (form.formState.isDirty || initial.current?.dirty === true || frozen);
  useUnsavedChanges(dirty);
  useEffect(() => {
    const subscription = form.watch(values => writeDraft(account.id, pair.pairId, key, {
      ...identity.current, values, frozen, dirty: true, submission: submission.current,
    }));
    return () => subscription.unsubscribe();
  }, [form, account.id, pair.pairId, key, frozen]);
  useEffect(() => {
    if (confirmed) navigate('/events/' + identity.current.id, { replace: true });
  }, [confirmed, navigate]);

  async function save(values: EventFormValues, confirmShared = false) {
    if (!online || saving) return;
    const scope = beginScope();
    setSaving(true);
    setError('');
    const input = submission.current ?? toEventInput({
      ...values, id: identity.current.id, pairId: pair!.status === 'active' ? pair!.pairId : '', confirmShared,
    });
    submission.current = input;
    setFrozen(true);
    writeDraft(account!.id, input.pairId, key, {
      ...identity.current, values, frozen: true, dirty: true, submission: input,
    });
    const captured = { ...identity.current };
    const result = idea
      ? await planDateIdea(idea.id, input, captured.ideaVersion!, captured.commandId)
      : event
      ? await updateEvent(event.id, input, captured.expectedVersion!, captured.commandId)
      : await createEvent(input, captured.commandId);
    if (!scope.isCurrent()) return;
    setSaving(false);
    if (result.ok) {
      removeDraft(account!.id, input.pairId, key);
      setConfirmed(true);
      return;
    }
    if (result.error.code === 'CONFLICT') {
      setError(idea ? 'This idea changed. Your draft is kept.' : 'This event changed. Your draft is kept.');
      setConflict(true);
      setFrozen(false);
      submission.current = undefined;
      identity.current.commandId = crypto.randomUUID();
    } else {
      setError(result.error.message ?? 'Save failed. Try again.');
      setFrozen(result.error.code === 'RETRYABLE');
      if (result.error.code !== 'RETRYABLE') {
        identity.current.commandId = crypto.randomUUID();
        submission.current = undefined;
      }
    }
    writeDraft(account!.id, input.pairId, key, {
      ...identity.current, values, frozen: result.error.code === 'RETRYABLE', dirty: true, submission: submission.current,
    });
  }

  function submitValues(values: EventFormValues) {
    if (event?.visibility === 'private' && values.visibility === 'shared') setSharing(values);
    else void save(values);
  }

  async function reloadEvent() {
    if (saving) return;
    const scope = beginScope();
    setSaving(true);
    try {
      if (idea) {
        const currentIdea = await getDateIdea(pair!.status === 'active' ? pair!.pairId : '', idea.id);
        if (!scope.isCurrent()) return;
        if (!currentIdea) {
          setError('Idea unavailable.');
          return;
        }
        identity.current.ideaVersion = currentIdea.version;
        identity.current.commandId = crypto.randomUUID();
        submission.current = undefined;
        initial.current = undefined;
        form.reset({ ...form.getValues(), title: currentIdea.title, description: currentIdea.note });
        setConflict(false);
        setError('');
        removeDraft(account!.id, currentIdea.pairId, key);
        return;
      }
      const current = await getEvent(pair!.status === 'active' ? pair!.pairId : '', event!.id);
      if (!scope.isCurrent()) return;
      if (!current) {
        setError('Event unavailable.');
        return;
      }
      form.reset(eventToForm(current));
      submission.current = undefined;
      identity.current.expectedVersion = current.version;
      identity.current.commandId = crypto.randomUUID();
      initial.current = undefined;
      setConflict(false);
      setError('');
      removeDraft(account!.id, current.pairId, key);
    } catch {
      if (!scope.isCurrent()) return;
      setError(idea ? 'We could not reload this idea. Try again.' : 'We could not reload this event. Try again.');
    } finally {
      if (scope.isCurrent()) setSaving(false);
    }
  }

  function confirmSharing() {
    const values = sharing!;
    setSharing(null);
    void save(values, true);
  }

  const names = {
    a: pair.members.find(member => member.slot === 'a')!.displayName,
    b: pair.members.find(member => member.slot === 'b')!.displayName,
    together: 'Together',
  };
  const slot = pair.members.find(member => member.userId === account.id)!.slot;
  return <>
    <PageHeader
      title={event ? 'Edit event' : idea ? 'Plan date' : 'Add event'}
    />
    <section className="card form-page">
      <form onSubmit={form.handleSubmit(submitValues)}>
        <EventFields form={form} names={names} slot={slot} author={!event || event.authorId === account.id} locked={saving || frozen} planning={Boolean(idea)} />
        {error && <Status error>{error}</Status>}
        {frozen && <p>Your save is unconfirmed. Retry with the same details.</p>}
        {conflict && (
          <Button
            type="button"
            variant="secondary"
            disabled={!online || saving}
            onClick={() => void reloadEvent()}
          >
            Reload event and discard draft
          </Button>
        )}
        <div className="actions">
          <Button disabled={!online || saving || conflict} type="submit">
            {saving ? 'Saving…' : frozen ? 'Retry save' : event ? 'Save changes' : 'Save event'}
          </Button>
          <Link to="/calendar">Cancel</Link>
        </div>
      </form>
    </section>
    <Dialog busy={saving} open={Boolean(sharing)} title="Share this event?" onClose={() => setSharing(null)}>
      <p>Your partner will see this event.</p>
      <Button onClick={confirmSharing}>Share event</Button>
    </Dialog>
  </>;
}
