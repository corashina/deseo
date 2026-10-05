import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DateTime } from 'luxon';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { inclusiveEndDate } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { useNetworkStatus } from '../../../lib/network';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { calendarKeys, getEvent, getEventReminder } from '../queries';
import { deleteEvent, setEventReminder } from '../commands';
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
      <EventReminder
        key={event.id} eventId={event.id} pairId={pair.pairId} accountId={account!.id}
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

type ReminderDraft = {
  choice: string;
  identity: { id: string; commandId: string };
  submission: Parameters<typeof setEventReminder>[0] | null;
  uncertain: boolean;
};

function EventReminder({ eventId, pairId, accountId, allDay, timezone }: {
  eventId: string; pairId: string; accountId: string; allDay: boolean; timezone: string;
}) {
  const online = useNetworkStatus();
  const query = useQuery({
    queryKey: [...calendarKeys.event(accountId, pairId, eventId), 'reminder'],
    queryFn: () => getEventReminder(eventId),
  });
  const draftKey = 'reminder:' + eventId;
  const draft = useRef(readDraft<ReminderDraft>(accountId, pairId, draftKey));
  const [choice, setChoice] = useState<string | null>(draft.current?.choice ?? null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(draft.current?.uncertain ?? false);
  const identity = useRef(draft.current?.identity ?? { id: crypto.randomUUID(), commandId: crypto.randomUUID() });
  const submission = useRef<ReminderDraft['submission']>(draft.current?.submission ?? null);
  useUnsavedChanges(choice !== null);
  useEffect(() => {
    if (choice !== null) {
      writeDraft(accountId, pairId, draftKey, { choice, identity: { ...identity.current }, submission: submission.current, uncertain });
    }
  }, [choice, uncertain, accountId, pairId, draftKey]);
  const current = query.data;
  const selected = choice ?? (current?.active ? String(current.minutesBefore) : 'none');

  function changeChoice(value: string) {
    setChoice(value);
    identity.current.commandId = crypto.randomUUID();
    submission.current = null;
    setMessage('');
  }

  async function saveReminder() {
    const scope = captureQueryScope();
    setSaving(true);
    submission.current ??= {
      id: current?.id ?? identity.current.id, pairId, eventId, taskId: null,
      minutesBefore: selected === 'none' ? null : Number(selected),
      remindAt: null, active: selected !== 'none', expectedVersion: current?.version ?? null,
    };
    // Save the entire attempt before a scope reset can unmount this component.
    const attempt = {
      choice: selected, identity: { ...identity.current }, submission: submission.current, uncertain: true,
    };
    writeDraft(accountId, pairId, draftKey, attempt);
    setChoice(selected);
    setUncertain(true);
    const result = await setEventReminder(attempt.submission, attempt.identity.commandId);
    try {
      scope.assertCurrent();
    } catch {
      setSaving(false);
      setMessage('Reminder save is unconfirmed. Retry with the same choice.');
      return;
    }
    setSaving(false);
    if (result.ok) {
      removeDraft(accountId, pairId, draftKey);
      submission.current = null;
      setMessage('Reminder saved.');
      setUncertain(false);
      setChoice(null);
      identity.current.commandId = crypto.randomUUID();
      await query.refetch();
      return;
    }
    setMessage(result.error.code === 'CONFLICT'
      ? 'Your reminder changed. Reload this page before saving.'
      : result.error.message ?? 'Reminder save failed. Try again.');
    setUncertain(result.error.code === 'RETRYABLE');
    if (result.error.code !== 'RETRYABLE') {
      submission.current = null;
      identity.current.commandId = crypto.randomUUID();
    }
  }

  if (query.isPending) return <Status>Loading your reminder…</Status>;
  if (query.isError) {
    return <><Status error>We could not load your reminder.</Status><Button onClick={() => void query.refetch()}>Retry</Button></>;
  }
  return <section className="event-reminder">
    <h2>Your reminder</h2>
    <p>{allDay ? `All-day reminders use 09:00 in ${timezone}.` : 'Choose how early you want a reminder.'}</p>
    <p className="muted">Reminders use native push. This browser receives no push alerts.</p>
    <label className="field">
      <span>Remind me</span>
      <select value={selected} disabled={saving || uncertain} onChange={e => changeChoice(e.target.value)}>
        <option value="none">None</option>
        <option value="15">15 minutes before</option>
        <option value="60">One hour before</option>
        <option value="1440">One day before</option>
      </select>
    </label>
    <Button variant="secondary" disabled={!online || saving} onClick={() => void saveReminder()}>
      {uncertain ? 'Retry reminder' : 'Save reminder'}
    </Button>
    {message && <Status>{message}</Status>}
  </section>;
}
