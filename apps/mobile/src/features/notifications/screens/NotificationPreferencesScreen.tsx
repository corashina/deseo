import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';
import { Section } from '../../../components/ui/Section';
import { Screen } from '../../../components/ui/Screen';
import { DateTimeField } from '../../../components/ui/DateTimeField';
import { TimezoneField } from '../../../components/ui/TimezoneField';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { useCore } from '../../pair';
import { captureQueryScope } from '../../../lib/query-client';
import { AppError, toAppError } from '@deseo/domain/result';
import { useTheme } from '../../../theme';
import { getNotificationPreferences, notificationKeys } from '../queries';
import { saveNotificationPreferences } from '../commands';
import { syncNotificationDevice } from '../device';
import { DevicePermission } from '../components/DevicePermission';
import type { NotificationPreferences } from '@deseo/domain/notifications';
export function NotificationPreferencesScreen() {
  const { account, online } = useCore();
  const query = useQuery({ queryKey: notificationKeys.preferences(account.id), queryFn: getNotificationPreferences });
  if (query.isPending) return <Screen title="Notifications"><Status tone="loading" message="Loading preferences…" /></Screen>;
  if (query.isError) return <Screen title="Notifications"><Status message="We could not load your preferences." actionLabel="Retry" onAction={() => { void query.refetch(); }} /></Screen>;
  return <PreferencesForm key={`${account.id}:${query.data.version}`} saved={query.data} online={online} reload={() => { void query.refetch(); }} />;
}
function PreferencesForm({ saved, online, reload }: { saved: NotificationPreferences; online: boolean; reload: () => void }) {
  const theme = useTheme();
  const [alerts, setAlerts] = useState(saved.messageAlerts); const [quiet, setQuiet] = useState(saved.quietStart !== null);
  const [start, setStart] = useState(saved.quietStart ?? '22:00'); const [end, setEnd] = useState(saved.quietEnd ?? '08:00');
  const [timezone, setTimezone] = useState(saved.timezone); const [defaultMinutes, setDefaultMinutes] = useState(saved.defaultEventReminderMinutes);
  const [busy, setBusy] = useState(false); const pending = useRef(false); const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false); const [permissionRefresh, setPermissionRefresh] = useState(0);
  const save = async () => {
    if (pending.current || !online) return;
    const scope = captureQueryScope(); pending.current = true; setBusy(true); setError(null);
    try {
      if (alerts) { await syncNotificationDevice(true); scope.assertCurrent(); setPermissionRefresh(value => value + 1); }
      const result = await saveNotificationPreferences({ ...saved, messageAlerts: alerts, quietStart: quiet ? start : null, quietEnd: quiet ? end : null,
        timezone, defaultEventReminderMinutes: defaultMinutes }); scope.assertCurrent();
      if (!result.ok) { setConflict(result.error.code === 'CONFLICT'); throw new AppError(result.error); }
      setError(null);
    } catch (error) { try { scope.assertCurrent(); setError(toAppError(error).message); } catch { /* Access guard owns recovery. */ } }
    finally { pending.current = false; try { scope.assertCurrent(); setBusy(false); } catch { /* Access guard owns recovery. */ } }
  };
  return <Screen title="Notification preferences" subtitle="These preferences apply to your account.">
    <Section card title="Device permission"><DevicePermission refresh={permissionRefresh} /></Section>
    <Section card title="Alerts">
    <Button label={alerts ? 'Message alerts: On' : 'Message alerts: Off'} variant="secondary" disabled={busy} onPress={() => setAlerts(value => !value)} />
    <Text style={theme.typography.secondary}>Push messages contain no event, task, or message text.</Text>
    <Text accessibilityRole="header" style={theme.typography.headline}>Default event reminder</Text>
    {([{ value: null, label: 'None' }, { value: 15, label: '15 minutes before' }, { value: 60, label: 'One hour before' }, { value: 1440, label: 'One day before' }] as const)
      .map(option => <Button key={String(option.value)} label={`${defaultMinutes === option.value ? 'Selected: ' : ''}${option.label}`} variant={defaultMinutes === option.value ? 'primary' : 'secondary'} disabled={busy} onPress={() => setDefaultMinutes(option.value)} />)}
    <Text style={theme.typography.secondary}>Choose Save reminder on each event to confirm its reminder.</Text>
    </Section>
    <Section card title="Quiet hours">
    <Button label={quiet ? 'Quiet hours: On' : 'Quiet hours: Off'} variant="secondary" disabled={busy} onPress={() => setQuiet(value => !value)} />
    {quiet && <><DateTimeField label="Quiet hours start" mode="time" value={start} onChange={setStart} disabled={busy} />
      <DateTimeField label="Quiet hours end" mode="time" value={end} onChange={setEnd} disabled={busy} /></>}
    <TimezoneField label="Notification timezone" value={timezone} onChange={setTimezone} disabled={busy} />
    <Text style={theme.typography.secondary}>Quiet hours defer pushes. Event pushes expire after the event starts.</Text>
    </Section>
    {!online && <Status message="Reconnect before saving preferences." />}
    {error && <Status message={error} tone="error" />}
    {conflict && <Button label="Discard changes and reload" variant="secondary" onPress={reload} />}
    <Button label="Save preferences" loading={busy} disabled={!online || conflict} onPress={() => { void save(); }} />
  </Screen>;
}
