import { RouteErrorPage } from '../../../app/RouteErrorPage';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DateTime } from 'luxon';
import { toAppError } from '@deseo/domain/result';
import { inclusiveEndDate } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { formatDate, formatRange } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { PartnerBadge } from '../../../components/ui/PartnerBadge';
import { useReturnTo } from '../../../lib/return-to';
import { calendarKeys, getEvent } from '../queries';
import { deleteEvent } from '../commands';
import '../../../styles/calendar.css';

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const back = useReturnTo('/calendar');
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({
    queryKey: calendarKeys.event(account!.id, pairId, eventId),
    queryFn: () => getEvent(pairId, eventId),
    enabled: Boolean(pairId),
  });
  const remove = useMutation({ mutationFn: (version: number) => deleteEvent(eventId, version), onSuccess: () => navigate(back), onError: () => void query.refetch(), onSettled: () => setConfirm(false) });
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
      ? 'Every year on ' + formatDate(DateTime.fromISO(event.temporal.startDate), 'dayMonth', account!.locale) + ' · All day'
      : formatRange(DateTime.fromISO(event.temporal.startDate), DateTime.fromISO(inclusiveEndDate(event.temporal.endDateExclusive)), 'date', account!.locale) + ' · All day';
  } else {
    const start = DateTime.fromISO(event.temporal.startsAt).setZone(event.timezone);
    const end = DateTime.fromISO(event.temporal.endsAt).setZone(event.timezone);
    time = formatRange(start, end, 'dateTime', account!.locale);
  }
  const editable = event.visibility === 'shared' || event.authorId === account!.id;
  return <>
    <PageHeader
      eyebrow="Event"
      title={event.title}
      description={<PartnerBadge name={names[event.owner]} slot={event.owner} />}
      action={editable && <Link className="button secondary" to={'/events/' + event.id + '/edit'} state={{ from: back }}>Edit event</Link>}
    />
    <section className="card event-detail">
      <dl>
        <dt>When</dt><dd>{time}</dd>
        {event.timezone !== account!.timezone && <><dt>Timezone</dt><dd translate="no">{event.timezone}</dd></>}
        <dt>Visibility</dt><dd>{event.visibility === 'private' ? 'Private to you' : 'Shared with your partner'}</dd>
        {event.importantDate && <><dt>Important date</dt><dd>Yes</dd></>}
        {event.location && <><dt>Location</dt><dd>{event.location}</dd></>}
        {event.description && <><dt>Description</dt><dd>{event.description}</dd></>}
      </dl>
      {error && <Status error>{error}</Status>}
      <div className="actions">
        <Link to={back}>Return to calendar</Link>
        {editable && <Button variant="secondary" disabled={remove.isPending} onClick={() => setConfirm(true)}>{remove.isError ? 'Retry deletion' : 'Delete event'}</Button>}
      </div>
    </section>
    <Dialog busy={remove.isPending} title="Delete this event?" open={confirm} onClose={() => setConfirm(false)}>
      <p>{event.visibility === 'private' ? 'You will lose access to this event.' : 'Both partners will lose access to this event.'}</p>
      <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(event.version)}>Confirm deletion</Button>
    </Dialog>
  </>;
}
