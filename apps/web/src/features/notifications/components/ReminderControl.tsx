import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AppError, toAppError } from '@deseo/domain/result';
import { DateTime } from 'luxon';
import { resolveWallTime } from '@deseo/domain/calendar';
import { useSession } from '../../../app/SessionProvider';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { useCommandId } from '../../../lib/command-id';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { getReminder, getNotificationPreferences, notificationKeys } from '../queries';
import { setReminder } from '../commands';
import '../../../styles/reminders.css';
type Props = { eventId?: string; taskId?: string; sourceVersion: number; timezone: string; allDay?: boolean; completed?: boolean; dueDate?: string | null };
type Draft = { choice: string; date: string; time: string; active: boolean };
export function ReminderControl(props: Props) {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const sourceId = props.eventId ?? props.taskId!;
  const [draft, setDraft] = useState<Draft>();
  const query = useQuery({ queryKey: [...notificationKeys.reminder(account!.id, pairId, sourceId), props.sourceVersion], queryFn: () => getReminder(props.eventId ?? null, props.taskId ?? null), enabled: Boolean(pairId) });
  const preferences = useQuery({ queryKey: notificationKeys.preferences(account!.id), queryFn: getNotificationPreferences, enabled: Boolean(props.eventId) });
  const current = query.data;
  const initial = current?.remindAt ? DateTime.fromISO(current.remindAt).setZone(props.timezone) : DateTime.now().setZone(props.timezone);
  const values: Draft = draft ?? { choice: String(current ? current.active ? current.minutesBefore : 'none' : preferences.data?.defaultEventReminderMinutes ?? 'none'),
    date: current?.remindAt ? initial.toISODate()! : props.dueDate ?? initial.toISODate()!, time: current?.remindAt ? initial.toFormat('HH:mm') : '09:00', active: current?.active ?? false };
  // A new reminder keeps one ID, so a retry of the same input sends the same request.
  const [newId] = useState(() => crypto.randomUUID());
  const command = useCommandId();
  const save = useMutation({
    mutationFn: () => {
      const active = props.eventId ? values.choice !== 'none' : values.active;
      let remindAt: string | null = null;
      try { if (props.taskId && active) remindAt = resolveWallTime(values.date, values.time, props.timezone); }
      catch { throw new AppError({ code: 'VALIDATION', message: 'Choose a valid reminder date and time.' }); }
      const input = {
        id: current?.id ?? newId, pairId, eventId: props.eventId ?? null, taskId: props.taskId ?? null,
        active, minutesBefore: props.eventId && active ? Number(values.choice) : null,
        remindAt, expectedVersion: current?.version ?? null,
      };
      return setReminder(input, command.idFor(input));
    },
    onSuccess: async () => { setDraft(undefined); command.reset(); await query.refetch(); },
  });
  const discard = useMutation({ mutationFn: () => query.refetch({ throwOnError: true }), onSuccess: () => { setDraft(undefined); save.reset(); } });
  useUnsavedChanges(Boolean(draft));
  function change(input: Partial<Draft>) { setDraft({ ...values, ...input }); save.reset(); }
  const conflict = save.isError && toAppError(save.error).code === 'CONFLICT';
  const busy = save.isPending || discard.isPending;
  const message = save.isSuccess ? 'Reminder saved.' : conflict ? 'Your reminder changed. Your draft is kept.' : save.isError ? toAppError(save.error).message : '';
  if (!pairId) return null;
  if ((query.isPending || props.eventId && preferences.isPending) && !draft) return <Status>Loading reminder…</Status>;
  if (query.isError && !draft) return <><Status error>We could not load your reminder.</Status><Button onClick={() => void query.refetch()}>Retry</Button></>;
  if (props.eventId && !current && preferences.isError && !draft) return <><Status error>We could not load your reminder preferences.</Status><Button onClick={() => void preferences.refetch()}>Retry</Button></>;
  return <section className="event-reminder"><h2>Your reminder</h2>
    <p>{props.allDay ? `All-day reminders use 09:00 in ${props.timezone}.` : props.eventId ? 'Choose how early you want a reminder.' : `Choose a date and time in ${props.timezone}.`}</p>
    <p className="muted">Reminders use native push. This browser receives no push alerts.</p>
    {current?.state === 'past' && <p>The reminder time has passed. No push was queued.</p>}
    {current?.nextDueAt && <p>Next reminder: {DateTime.fromISO(current.nextDueAt).setZone(props.timezone).toFormat('d LLL yyyy, HH:mm')} ({props.timezone})</p>}
    <fieldset className="field-group" disabled={busy || props.completed}>
    {props.eventId ? <label className="field"><span>Remind me</span><select value={values.choice} onChange={event => change({ choice: event.target.value })}>
      <option value="none">None</option><option value="15">15 minutes before</option><option value="60">One hour before</option><option value="1440">One day before</option>
    </select></label> : <><label className="field field-check"><span><input type="checkbox" checked={values.active} onChange={event => change({ active: event.target.checked })} /> Task reminder</span></label>
    {values.active && <><Field label="Reminder date" type="date" value={values.date} onChange={event => change({ date: event.target.value })} /><Field label="Reminder time" type="time" value={values.time} onChange={event => change({ time: event.target.value })} /></>}</>}
    </fieldset>{props.completed && <p>Completed tasks do not send reminders.</p>}
    {message && <Status error={save.isError}>{message}</Status>}
    {conflict && <Button disabled={busy} variant="secondary" onClick={() => discard.mutate()}>Discard changes and reload</Button>}
    <Button variant="secondary" disabled={busy || conflict || props.completed} onClick={() => save.mutate()}>{save.isError ? 'Retry reminder' : 'Save reminder'}</Button>
  </section>;
}
