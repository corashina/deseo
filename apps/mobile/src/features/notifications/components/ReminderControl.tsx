import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { DateTime } from 'luxon';
import { Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { captureQueryScope } from '../../../lib/query-client';
import { toAppError } from '@deseo/domain/result';
import { theme, ui } from '../../../theme';
import { useCore } from '../../pair';
import { getNotificationPreferences, getReminder, notificationKeys } from '../queries';
import { setReminder } from '../commands';
import { syncNotificationDevice } from '../device';
import { taskReminderInstant } from '../time';
import { DevicePermission } from './DevicePermission';
import type { Reminder, ReminderInput } from '@deseo/domain/notifications';
type Props = { eventId?: string; taskId?: string; sourceVersion: number; timezone: string; allDay?: boolean; completed?: boolean; dueDate?: string | null };
export function ReminderControl(props: Props) {
  const core = useCore(); const pairId = core.pair.status === 'active' ? core.pair.pairId : '';
  const query = useQuery({ queryKey: [...notificationKeys.reminder(core.account.id, pairId, props.eventId ?? props.taskId!), props.sourceVersion],
    queryFn: () => getReminder(props.eventId ?? null, props.taskId ?? null), enabled: !!pairId });
  const preferences = useQuery({ queryKey: notificationKeys.preferences(core.account.id), queryFn: getNotificationPreferences, enabled: !!pairId && !!props.eventId });
  if (!pairId) return null;
  if (query.isPending || props.eventId && preferences.isPending) return <Status tone="loading" message="Loading your reminder…" />;
  if (query.isError) return <Status message="We could not load your reminder." actionLabel="Retry" onAction={() => { void query.refetch(); }} />;
  return <ReminderForm key={`${core.account.id}:${pairId}:${props.eventId ?? props.taskId}:${query.data?.version ?? 0}`}
    {...props} pairId={pairId} online={core.online} saved={query.data} defaultMinutes={preferences.data?.defaultEventReminderMinutes ?? null} />;
}
function ReminderForm({ pairId, online, saved, defaultMinutes, ...props }: Props & { pairId: string; online: boolean; saved: Reminder | null; defaultMinutes: number | null }) {
  const [choice, setChoice] = useState<number | null>(saved ? saved.active ? saved.minutesBefore : null : defaultMinutes);
  const initial = saved?.remindAt ? DateTime.fromISO(saved.remindAt).setZone(props.timezone) : DateTime.now().setZone(props.timezone);
  const [date, setDate] = useState(saved?.remindAt ? initial.toISODate()! : props.dueDate ?? initial.toISODate()!);
  const [time, setTime] = useState(saved?.remindAt ? initial.toFormat('HH:mm') : '09:00');
  const [taskEnabled, setTaskEnabled] = useState(saved?.active ?? false);
  const [error, setError] = useState<string | null>(null); const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const pending = useRef(false); const [permissionRefresh, setPermissionRefresh] = useState(0);
  const intent = useRef<{ input: ReminderInput; commandId: string } | null>(null);
  const save = async () => {
    if (!online || pending.current) return;
    const scope = captureQueryScope(); pending.current = true; setBusy(true); setError(null); setStatus(null);
    try {
      const active = props.eventId ? choice !== null : taskEnabled;
      const input: ReminderInput = { id: saved?.id ?? intent.current?.input.id ?? randomUUID(), pairId, eventId: props.eventId ?? null, taskId: props.taskId ?? null,
        minutesBefore: props.eventId ? choice : null, remindAt: props.taskId && active ? taskReminderInstant(date, time, props.timezone) : null,
        active, expectedVersion: saved?.version ?? null };
      if (!intent.current || JSON.stringify(intent.current.input) !== JSON.stringify(input)) intent.current = { input, commandId: randomUUID() };
      // The permission prompt follows an explicit Save reminder action.
      if (active) { await syncNotificationDevice(true); scope.assertCurrent(); setPermissionRefresh(value => value + 1); }
      const result = await setReminder(intent.current.input, intent.current.commandId); scope.assertCurrent();
      if (!result.ok) throw toAppError(result.error);
      setStatus(result.data.state === 'past' ? 'The reminder time has passed. No push was queued.' : result.data.active ? 'Your reminder is saved.' : 'Your reminder is off.');
    } catch (error) { try { scope.assertCurrent(); setError(toAppError(error).message); } catch { /* Access guard owns recovery. */ } }
    finally { pending.current = false; try { scope.assertCurrent(); setBusy(false); } catch { /* Access guard owns recovery. */ } }
  };
  return <View style={ui.card}>
    <Text accessibilityRole="header" style={theme.typography.section}>Your reminder</Text>
    <DevicePermission refresh={permissionRefresh} />
    {saved && <Text style={theme.typography.secondary}>{saved.state === 'past' ? 'The selected reminder time has passed.' : saved.active ? 'Your reminder is on.' : 'Your reminder is off.'}</Text>}
    {saved?.nextDueAt && <Text style={theme.typography.secondary}>Next: {DateTime.fromISO(saved.nextDueAt).setZone(props.timezone).toLocaleString(DateTime.DATETIME_MED)} ({props.timezone})</Text>}
    {props.eventId ? <>
      {props.allDay && <Text style={theme.typography.secondary}>Choose how long before 09:00 in {props.timezone} to receive an all-day reminder.</Text>}
      {([{ value: null, label: 'None' }, { value: 15, label: props.allDay ? '15 minutes before 09:00' : '15 minutes before' },
        { value: 60, label: props.allDay ? 'One hour before 09:00' : 'One hour before' },
        { value: 1440, label: props.allDay ? '24 hours before 09:00' : 'One day before' }] as const).map(option =>
        <Button key={String(option.value)} label={`${choice === option.value ? 'Selected: ' : ''}${option.label}`} variant="secondary" disabled={busy} onPress={() => setChoice(option.value)} />)}
    </> : <>
      <Button label={taskEnabled ? 'Turn reminder off' : 'Choose reminder time'} variant="secondary" disabled={busy || props.completed} onPress={() => setTaskEnabled(value => !value)} />
      {taskEnabled && <><Field label="Reminder date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" editable={!busy} />
        <Field label="Reminder time" value={time} onChangeText={setTime} placeholder="HH:mm" editable={!busy} />
        <Text style={theme.typography.secondary}>Timezone: {props.timezone}</Text></>}
      {props.completed && <Text style={theme.typography.secondary}>Completed tasks do not send reminders.</Text>}
    </>}
    {error && <Status message={error} tone="error" />}{status && <Status message={status} />}
    <Button label="Save reminder" loading={busy} disabled={!online || !!props.completed} onPress={() => { void save(); }} />
  </View>;
}
