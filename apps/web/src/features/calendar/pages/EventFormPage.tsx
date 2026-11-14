import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { getDateIdea, ideaKeys, planDateIdea, type DateIdea } from '../ideas';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { eventFormSchema, eventToForm, toEventInput, type Event, type EventFormValues } from '@deseo/domain/calendar';
import { AppError, toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { Dialog } from '../../../components/ui/Dialog';
import { calendarKeys, getEvent } from '../queries';
import { createEvent, updateEvent } from '../commands';
import { EventFields } from '../components/EventFields';
import '../../../styles/calendar.css';

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

  if (!account || pair?.status !== 'active') throw new Error('Active pair required');
  const [id] = useState(() => event?.id ?? crypto.randomUUID());
  // Keep the version the draft started from. A concurrent edit then fails with CONFLICT.
  const [version, setVersion] = useState(idea?.version ?? event?.version);
  const [sharing, setSharing] = useState<EventFormValues | null>(null);
  const [now] = useState(() => DateTime.now().setZone(account.timezone));
  const date = DateTime.fromISO(params.get('date') ?? '');
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: event ? eventToForm(event) : {
      title: idea?.title ?? '', allDay: false,
      startDate: date.isValid ? date.toISODate()! : now.toISODate()!,
      endDate: date.isValid ? date.toISODate()! : now.toISODate()!,
      startTime: '18:00', endTime: '19:00', timezone: account.timezone,
      owner: 'together', visibility: 'shared', location: '', description: idea?.note ?? '', repeat: 'none', importantDate: false,
    },
  });
  const save = useMutation({
    mutationFn: ({ values, confirmShared }: { values: EventFormValues; confirmShared: boolean }) => {
      const input = toEventInput({ ...values, id, pairId: pair.pairId, confirmShared });
      return idea ? planDateIdea(idea.id, input, version!) : event ? updateEvent(input, version!) : createEvent(input);
    },
  });
  const reload = useMutation({
    mutationFn: async () => {
      if (idea) {
        const current = await getDateIdea(pair.pairId, idea.id);
        if (!current) throw new AppError({ code: 'FORBIDDEN', message: 'Idea unavailable.' });
        form.reset({ ...form.getValues(), title: current.title, description: current.note });
        setVersion(current.version);
        return;
      }
      const current = await getEvent(pair.pairId, event!.id);
      if (!current) throw new AppError({ code: 'FORBIDDEN', message: 'Event unavailable.' });
      form.reset(eventToForm(current));
      setVersion(current.version);
    },
    onSuccess: () => save.reset(),
  });
  const failure = save.isError ? toAppError(save.error) : null;
  const conflict = failure?.code === 'CONFLICT';
  const error = reload.isError ? toAppError(reload.error).message
    : conflict ? (idea ? 'This idea changed. Your draft is kept.' : 'This event changed. Your draft is kept.')
    : failure?.message ?? '';
  const saving = save.isPending || reload.isPending;
  useUnsavedChanges(!save.isSuccess && form.formState.isDirty);
  useEffect(() => {
    if (save.isSuccess) navigate('/events/' + id, { replace: true });
  }, [save.isSuccess, navigate, id]);

  function submitValues(values: EventFormValues) {
    if (event?.visibility === 'private' && values.visibility === 'shared') setSharing(values);
    else save.mutate({ values, confirmShared: false });
  }

  function confirmSharing() {
    const values = sharing!;
    setSharing(null);
    save.mutate({ values, confirmShared: true });
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
      description={event ? 'Keep the details up to date.' : 'Plan time for yourself or together.'}
    />
    <section className="card form-page">
      <form onSubmit={form.handleSubmit(submitValues)}>
        <EventFields form={form} names={names} slot={slot} author={!event || event.authorId === account.id} locked={saving} planning={Boolean(idea)} />
        {error && <Status error>{error}</Status>}
        {conflict && (
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => reload.mutate()}
          >
            Reload event and discard draft
          </Button>
        )}
        <div className="actions">
          <Button disabled={saving || conflict} type="submit">
            {saving ? 'Saving…' : failure ? 'Retry save' : event ? 'Save changes' : 'Save event'}
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
