import { RouteErrorPage } from '../../../app/RouteErrorPage';
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
import { formatDate, formatRange } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { calendarKeys, getEvent } from '../queries';
import { deleteEvent } from '../commands';
import { readDraft, writeDraft, removeDraft } from '../../../lib/drafts';
import { useCommandScope } from '../../../lib/use-command-scope';
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
  const beginScope = useCommandScope(() => { setSaving(false); });
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const key = 'event-delete:' + eventId;
  const deleteAttempt = useRef(readDraft<{ version: number; commandId: string }>(account!.id, pairId, key));
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
    if (!online || saving || (!event && !deleteAttempt.current)) return;
    const scope = beginScope();
    setSaving(true);
    deleteAttempt.current ??= { version: event!.version, commandId: crypto.randomUUID() };
    writeDraft(account!.id, pairId, key, deleteAttempt.current);
    const result = await deleteEvent(eventId, deleteAttempt.current.version, deleteAttempt.current.commandId);
    if (!scope.isCurrent()) return;
    setSaving(false);
    if (result.ok) {
      removeDraft(account!.id, pairId, key);
      deleteAttempt.current = undefined;
      navigate('/calendar');
      return;
    }
    setError(result.error.code === 'CONFLICT'
      ? 'This event changed. Open it again before deleting.'
      : result.error.message ?? 'Deletion failed. Try again.');
    if (result.error.code !== 'RETRYABLE') {
      deleteAttempt.current = undefined;
      removeDraft(account!.id, pairId, key);
    }
    setConfirm(false);
  }

  if (query.isPending) return <Status>Loading event…</Status>;
  if (query.isError) {
    return <RouteErrorPage title="Event" returnTo="/calendar" returnLabel="Return to calendar" error={query.error} onRetry={() => void query.refetch()}>{deleteAttempt.current && <Button disabled={!online || saving} onClick={() => void confirmDeletion()}>Retry deletion</Button>}{error && <Status error>{error}</Status>}</RouteErrorPage>;
  }
  const event = query.data;
  if (!event || pair?.status !== 'active') {
    return <RouteErrorPage title="Event" returnTo="/calendar" returnLabel="Return to calendar">{deleteAttempt.current && <Button disabled={!online || saving} onClick={() => void confirmDeletion()}>Retry deletion</Button>}{error && <Status error>{error}</Status>}</RouteErrorPage>;
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
      {deleteAttempt.current && !saving && <Button disabled={!online} onClick={() => void confirmDeletion()}>Retry deletion</Button>}
    </section>
    <Dialog busy={saving} title="Delete this event?" open={confirm} onClose={() => setConfirm(false)}>
      <p>{event.visibility === 'private' ? 'You will lose access to this event.' : 'Both partners will lose access to this event.'}</p>
      <Button variant="danger" disabled={!online || saving} onClick={() => void confirmDeletion()}>Confirm deletion</Button>
    </Dialog>
  </>;
}
