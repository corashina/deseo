import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DateTime } from 'luxon';
import { toAppError } from '@deseo/domain/result';
import { ReminderControl } from '../../notifications';
import { inclusiveEndDate } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { calendarKeys, getEvent } from '../queries';
import { deleteEvent } from '../commands';
import { useCalendarSignals } from '../realtime';
import '../../../styles/calendar.css';

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({
    queryKey: calendarKeys.event(account!.id, pairId, eventId),
    queryFn: () => getEvent(pairId, eventId),
    enabled: Boolean(pairId),
  });
  useCalendarSignals(account!.id, pair);
  const remove = useMutation({ mutationFn: (version: number) => deleteEvent(eventId, version), onSuccess: () => navigate('/calendar'), onError: () => void query.refetch(), onSettled: () => setConfirm(false) });
  const error = remove.isError ? toAppError(remove.error).code === 'CONFLICT'
    ? 'This event changed. Review it before deleting.'
    : toAppError(remove.error).message : '';

  if (query.isPending) return <Status>Loading event…</Status>;
  if (query.isError) {
    return <RouteErrorPage title="Event" returnTo="/calendar" returnLabel="Return to calendar" error={query.error} onRetry={() => void query.refetch()} />;
  }
  const event = query.data;
  if (!event || pair?.status !== 'active') {
    return <RouteErrorPage title="Event" returnTo="/calendar" returnLabel="Return to calendar" />;
  }
  const names = {
    a: pair.members.find(member => member.slot === 'a')!.displayName,
    b: pair.members.find(member => member.slot === 'b')!.displayName,
    together: 'Together',
  };
  let time: string;
  if (event.temporal.kind === 'allDay') {
    time = event.repeat === 'yearly'
      ? 'Every year on ' + DateTime.fromISO(event.temporal.startDate).setLocale('en').toFormat('d LLLL') + ' · All day'
      : `${event.temporal.startDate} to ${inclusiveEndDate(event.temporal.endDateExclusive)} · All day`;
  } else {
    const start = DateTime.fromISO(event.temporal.startsAt).setZone(event.timezone).setLocale('en');
    const end = DateTime.fromISO(event.temporal.endsAt).setZone(event.timezone).setLocale('en');
    time = `${start.toFormat('d LLL yyyy, HH:mm')} to ${end.toFormat('d LLL yyyy, HH:mm')}`;
  }
  const editable = event.visibility === 'shared' || event.authorId === account!.id;
  return <>
    <PageHeader
      title={event.title}
      description={names[event.owner]}
      action={editable && <Link className="button secondary" to={'/events/' + event.id + '/edit'}>Edit event</Link>}
    />
    <section className="card event-detail">
      <dl>
        <dt>When</dt><dd>{time}</dd>
        <dt>Timezone</dt><dd>{event.timezone}</dd>
        <dt>Visibility</dt><dd>{event.visibility === 'private' ? 'Private to you' : 'Shared with your partner'}</dd>
        <dt>Repeat</dt><dd>{event.repeat === 'yearly' ? 'Every year' : 'Does not repeat'}</dd>
        {event.importantDate && <><dt>Important date</dt><dd>Yes</dd></>}
        {event.location && <><dt>Location</dt><dd>{event.location}</dd></>}
        {event.description && <><dt>Description</dt><dd>{event.description}</dd></>}
      </dl>
      <ReminderControl
        key={event.id} eventId={event.id} sourceVersion={event.version}
        allDay={event.temporal.kind === 'allDay'} timezone={event.timezone}
      />
      <div className="actions">
        <Link to="/calendar">Return to calendar</Link>
        {editable && <Button variant="danger" disabled={remove.isPending} onClick={() => setConfirm(true)}>{remove.isError ? 'Retry deletion' : 'Delete event'}</Button>}
      </div>
      {error && <Status error>{error}</Status>}
    </section>
    <Dialog busy={remove.isPending} title="Delete this event?" open={confirm} onClose={() => setConfirm(false)}>
      <p>{event.visibility === 'private' ? 'You will lose access to this event.' : 'Both partners will lose access to this event.'}</p>
      <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(event.version)}>Confirm deletion</Button>
    </Dialog>
  </>;
}
