import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DateTime } from 'luxon';
import { ReminderControl } from '../../notifications';
import { inclusiveEndDate } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { useNetworkStatus } from '../../../lib/network';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { calendarKeys, getEvent } from '../queries';
import { deleteEvent } from '../commands';
import { captureQueryScope } from '../../../lib/query-client';
import { getSupabase } from '../../../lib/supabase';
import '../../../styles/calendar.css';

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const { account, pair } = useSession();
  const navigate = useNavigate();
  const online = useNetworkStatus();
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const command = useRef(crypto.randomUUID());
  const deleteAttempt = useRef<{ version: number; commandId: string } | null>(null);
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const query = useQuery({
    queryKey: calendarKeys.event(account!.id, pairId, eventId),
    queryFn: () => getEvent(pairId, eventId),
    enabled: Boolean(pairId),
  });
  useEffect(() => {
    if (!pairId) return;
    const client = getSupabase();
    const channel = client.channel('event:' + eventId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: 'id=eq.' + eventId }, () => {
        void query.refetch();
      }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [pairId, eventId, query.refetch]);

  async function confirmDeletion() {
    const event = query.data;
    if (!event) return;
    const scope = captureQueryScope();
    setSaving(true);
    deleteAttempt.current ??= { version: event.version, commandId: command.current };
    const result = await deleteEvent(event.id, deleteAttempt.current.version, deleteAttempt.current.commandId);
    try {
      scope.assertCurrent();
    } catch {
      setSaving(false);
      setError('Deletion is unconfirmed. Retry deletion with the same event.');
      return;
    }
    setSaving(false);
    if (result.ok) {
      navigate('/calendar');
      return;
    }
    setError(result.error.code === 'CONFLICT'
      ? 'This event changed. Open it again before deleting.'
      : result.error.message ?? 'Deletion failed. Try again.');
    if (result.error.code !== 'RETRYABLE') {
      command.current = crypto.randomUUID();
      deleteAttempt.current = null;
    }
    setConfirm(false);
  }

  if (query.isPending) return <Status>Loading event…</Status>;
  if (query.isError) {
    return <><Status error>We could not load this event.</Status><Button onClick={() => void query.refetch()}>Retry</Button></>;
  }
  const event = query.data;
  if (!event || pair?.status !== 'active') {
    return <section className="card">
      <h1>Event unavailable</h1><p>You cannot open this event.</p>
      <Link to="/calendar">Return to calendar</Link>
    </section>;
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
        {editable && <Button variant="danger" disabled={!online} onClick={() => setConfirm(true)}>Delete event</Button>}
      </div>
      {error && <Status error>{error}</Status>}
    </section>
    <Dialog title="Delete this event?" open={confirm} onClose={() => setConfirm(false)}>
      <p>{event.visibility === 'private' ? 'You will lose access to this event.' : 'Both partners will lose access to this event.'}</p>
      <Button variant="danger" disabled={!online || saving} onClick={() => void confirmDeletion()}>Confirm deletion</Button>
    </Dialog>
  </>;
}
