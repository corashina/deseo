import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { DetailRow } from '../../../components/ui/DetailRow';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { useTheme } from '../../../theme';
import { useCore } from '../../pair';
import { ReminderControl } from '../../notifications';
import { captureQueryScope } from '../../../lib/query-client';
import type { CommandError } from '@deseo/domain/result';
import { eventDateLabel } from '../components/EventRow';
import { useCalendarSignals } from '../realtime';
import { deleteEvent } from '../commands';
import { calendarKeys, getEvent } from '../queries';

type Core = ReturnType<typeof useCore>;
export function EventDetailScreen({ eventId }: { eventId: string }) {
  const core = useCore();
  if (core.pair.status !== 'active') return <Screen title="Event"><Status message="You cannot access this event." /></Screen>;
  return <ActiveDetail key={`${core.account.id}:${core.pair.pairId}:${eventId}`} eventId={eventId} account={core.account} pair={core.pair} online={core.online} refresh={core.refresh} />;
}
function ActiveDetail({ eventId, account, pair, online, refresh }: { eventId: string; account: Core['account']; pair: Extract<Core['pair'], { status: 'active' }>; online: boolean; refresh: Core['refresh'] }) {
  const theme = useTheme();
  const router = useRouter();
  useCalendarSignals(account.id, pair.pairId, refresh);
  const query = useQuery({ queryKey: calendarKeys.event(account.id, pair.pairId, eventId), queryFn: () => getEvent(pair.pairId, eventId) });
  const deleteIntent = useRef<{ id: string; version: number; commandId: string } | null>(null);
  const pendingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<CommandError | null>(null);
  const remove = async () => {
    if (!query.data || pendingRef.current) return;
    const scope = captureQueryScope();
    pendingRef.current = true; setDeleting(true);
    deleteIntent.current ??= { id: query.data.id, version: query.data.version, commandId: randomUUID() };
    const intent = deleteIntent.current;
    const result = await deleteEvent(intent.id, intent.version, intent.commandId);
    try { scope.assertCurrent(); } catch { return; }
    pendingRef.current = false; setDeleting(false);
    if (result.ok) router.replace('/(tabs)/calendar');
    else setError(result.error);
  };
  const reload = async () => {
    const result = await query.refetch();
    if (!result.isError) { deleteIntent.current = null; setError(null); }
  };
  if (query.isPending) return <Screen title="Event"><Status tone="loading" message="Loading your event…" /></Screen>;
  if (query.isError) return <Screen title="Event"><Status tone="error" message="We could not load this event." actionLabel="Retry" onAction={() => { void query.refetch(); }} /></Screen>;
  const event = query.data;
  if (!event) return <Screen title="Event"><Status message="This event is unavailable. It may have been deleted or made private." /></Screen>;
  const name = event.owner === 'together' ? 'Together' : pair.members.find((member) => member.slot === event.owner)!.displayName;
  return <Screen title={event.title} refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    {event.repeat === 'yearly' && <Status message="This date repeats yearly. Edits and deletion apply to the series. February 29 uses February 28 in non-leap years." />}
    {!online && <Status tone="warning" message="You are offline. Reconnect before you change this event." />}
    <View style={theme.ui.card}>
      <DetailRow icon="calendar-outline" note={[event.temporal.kind === 'allDay' && 'All day',
        event.temporal.kind === 'timed' && account.timezone !== event.timezone && `In ${event.timezone}: ${eventDateLabel(event, event.timezone)}`]}>
        {eventDateLabel(event, account.timezone)}
      </DetailRow>
      <DetailRow icon="globe-outline" note={event.temporal.kind === 'timed' && account.timezone !== event.timezone ? `Your timezone: ${account.timezone}` : undefined}>
        {`Event timezone: ${event.timezone}`}
      </DetailRow>
      <DetailRow icon="people-outline"><Badge owner={event.owner} label={name} /></DetailRow>
      <DetailRow icon={event.visibility === 'private' ? 'lock-closed-outline' : 'eye-outline'}>
        {event.visibility === 'private' ? 'Private · Only you can see this event.' : 'Shared · Both partners can see this event.'}
      </DetailRow>
      {event.location ? <DetailRow icon="location-outline">{event.location}</DetailRow> : null}
      {event.description ? <DetailRow icon="document-text-outline">{event.description}</DetailRow> : null}
    </View>
    {error && <Status tone="error" message={error.code === 'CONFLICT' ? 'Your partner changed this event. Reload it before you delete it.' : 'We could not delete this event.'}
      actionLabel={error.code === 'CONFLICT' ? 'Reload saved version' : 'Retry delete'} onAction={() => { void (error.code === 'CONFLICT' ? reload() : remove()); }} />}
    <ReminderControl eventId={event.id} sourceVersion={event.version} timezone={event.timezone} allDay={event.temporal.kind === 'allDay'} />
    <Button label={event.repeat === 'yearly' ? 'Edit series' : 'Edit event'} disabled={!online || deleting} onPress={() => router.push({ pathname: '/events/[eventId]/edit', params: { eventId } })} />
    <Button label="Delete event" variant="danger" disabled={!online || deleting} loading={deleting} onPress={() => Alert.alert(`Delete “${event.title}”?`, 'You will remove this event.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete event', style: 'destructive', onPress: () => { void remove(); } },
    ])} />
  </Screen>;
}
