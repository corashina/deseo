import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { resolveWallTime } from '@deseo/domain/calendar';
import type { ReminderInput } from '@deseo/domain/notifications';
import { useSession } from '../../../app/SessionProvider';
import { captureQueryScope } from '../../../lib/query-client';
import { readDraft, writeDraft, removeDraft, useUnsavedChanges } from '../../../lib/drafts';
import { useNetworkStatus } from '../../../lib/network';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { getReminder, getNotificationPreferences, notificationKeys } from '../queries';
import { setReminder } from '../commands';
type Props = { eventId?: string; taskId?: string; sourceVersion: number; timezone: string; allDay?: boolean; completed?: boolean; dueDate?: string | null };
type Draft = { choice: string; date: string; time: string; active: boolean; attempt: { input: ReminderInput; commandId: string } | null };
export function ReminderControl(props: Props) {
  const { account, pair } = useSession(); const online = useNetworkStatus();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const sourceId = props.eventId ?? props.taskId!; const key = 'reminder:' + sourceId;
  const mounted = useRef(false); const pending = useRef(false);
  const scopeCleanup = useRef<() => void>(undefined);
  const [draft, setDraft] = useState(() => readDraft<Draft>(account!.id, pairId, key));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [conflict, setConflict] = useState(false);
  const query = useQuery({ queryKey: [...notificationKeys.reminder(account!.id, pairId, sourceId), props.sourceVersion], queryFn: () => getReminder(props.eventId ?? null, props.taskId ?? null), enabled: Boolean(pairId) });
  const preferences = useQuery({ queryKey: notificationKeys.preferences(account!.id), queryFn: getNotificationPreferences, enabled: Boolean(props.eventId) });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; scopeCleanup.current?.(); }; }, []);
  function beginScope() {
    scopeCleanup.current?.();
    const scope = captureQueryScope();
    const unlock = () => { if (mounted.current) { pending.current = false; setBusy(false); } };
    scope.signal.addEventListener('abort', unlock, { once: true });
    scopeCleanup.current = () => scope.signal.removeEventListener('abort', unlock);
    return scope;
  }
  useUnsavedChanges(Boolean(draft));
  const current = query.data;
  const initial = current?.remindAt ? DateTime.fromISO(current.remindAt).setZone(props.timezone) : DateTime.now().setZone(props.timezone);
  const values: Draft = draft ?? { choice: String(current ? current.active ? current.minutesBefore : 'none' : preferences.data?.defaultEventReminderMinutes ?? 'none'),
    date: current?.remindAt ? initial.toISODate()! : props.dueDate ?? initial.toISODate()!, time: current?.remindAt ? initial.toFormat('HH:mm') : '09:00', active: current?.active ?? false, attempt: null };
  function change(input: Partial<Draft>) { const next = { ...values, ...input, attempt: null }; writeDraft(account!.id, pairId, key, next); setDraft(next); setMessage(''); }
  async function save() {
    if (!online || pending.current || conflict || props.completed) return;
    const scope = beginScope(); pending.current = true; setBusy(true); setMessage('');
    let next: Draft | undefined;
    try {
      const active = props.eventId ? values.choice !== 'none' : values.active;
      const attempt = values.attempt ?? { commandId: crypto.randomUUID(), input: {
        id: current?.id ?? crypto.randomUUID(), pairId, eventId: props.eventId ?? null, taskId: props.taskId ?? null,
        active, minutesBefore: props.eventId && active ? Number(values.choice) : null,
        remindAt: props.taskId && active ? resolveWallTime(values.date, values.time, props.timezone) : null, expectedVersion: current?.version ?? null,
      } };
      next = { ...values, attempt };
      writeDraft(account!.id, pairId, key, next); setDraft(next);
      const result = await setReminder(attempt.input, attempt.commandId); scope.assertCurrent();
      if (!mounted.current) return;
      if (result.ok) {
        removeDraft(account!.id, pairId, key); setDraft(undefined);
        setMessage('Reminder saved.'); await query.refetch();
      } else {
        setMessage(result.error.code === 'CONFLICT' ? 'Your reminder changed. Your draft is kept.' : result.error.message ?? 'Reminder save failed. Retry.');
        if (result.error.code !== 'RETRYABLE') { const rejected = { ...next, attempt: null }; writeDraft(account!.id, pairId, key, rejected); setDraft(rejected); }
        setConflict(result.error.code === 'CONFLICT');
      }
    } catch {
      if (mounted.current && !scope.signal.aborted) setMessage(next ? 'Reminder save is unconfirmed. Retry the same choice.' : 'Choose a valid reminder date and time.');
    } finally { if (mounted.current && !scope.signal.aborted) { pending.current = false; setBusy(false); } }
  }
  if (!pairId) return null;
  if ((query.isPending || props.eventId && preferences.isPending) && !draft) return <Status>Loading your reminder…</Status>;
  if (query.isError && !draft) return <><Status error>We could not load your reminder.</Status><Button onClick={() => void query.refetch()}>Retry</Button></>;
  if (props.eventId && !current && preferences.isError && !draft) return <><Status error>We could not load your reminder preferences.</Status><Button onClick={() => void preferences.refetch()}>Retry</Button></>;
  return <section className="event-reminder"><h2>Your reminder</h2>
    <p>{props.allDay ? `All-day reminders use 09:00 in ${props.timezone}.` : props.eventId ? 'Choose how early you want a reminder.' : `Choose a date and time in ${props.timezone}.`}</p>
    <p className="muted">Reminders use native push. This browser receives no push alerts.</p>
    {current?.state === 'past' && <p>The reminder time has passed. No push was queued.</p>}
    {current?.nextDueAt && <p>Next reminder: {DateTime.fromISO(current.nextDueAt).setZone(props.timezone).toFormat('d LLL yyyy, HH:mm')} ({props.timezone})</p>}
    <fieldset className="field-group" disabled={busy || Boolean(draft?.attempt) || props.completed}>
    {props.eventId ? <label className="field"><span>Remind me</span><select value={values.choice} onChange={event => change({ choice: event.target.value })}>
      <option value="none">None</option><option value="15">15 minutes before</option><option value="60">One hour before</option><option value="1440">One day before</option>
    </select></label> : <><label className="field field-check"><span><input type="checkbox" checked={values.active} onChange={event => change({ active: event.target.checked })} /> Task reminder</span></label>
    {values.active && <><Field label="Reminder date" type="date" value={values.date} onChange={event => change({ date: event.target.value })} /><Field label="Reminder time" type="time" value={values.time} onChange={event => change({ time: event.target.value })} /></>}</>}
    </fieldset>{props.completed && <p>Completed tasks do not send reminders.</p>}
    {message && <Status error={conflict}>{message}</Status>}
    {conflict && <Button disabled={!online || busy} variant="secondary" onClick={async () => { const scope = beginScope(); const fresh = await query.refetch(); if (!mounted.current || scope.signal.aborted || fresh.isError) return; removeDraft(account!.id, pairId, key); setDraft(undefined); setConflict(false); setMessage(''); }}>Discard changes and reload</Button>}
    <Button variant="secondary" disabled={!online || busy || conflict || props.completed} onClick={() => void save()}>{draft?.attempt ? 'Retry reminder' : 'Save reminder'}</Button>
  </section>;
}
