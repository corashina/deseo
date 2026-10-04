import { DateTime } from 'luxon';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Status } from '../../../components/ui/Status';
import { EventRow } from '../../calendar';
import { useCore } from '../../pair';
import { theme, ui } from '../../../theme';
import { getToday } from '../queries';
import { todayKeys } from '../keys';

export function TodayScreen() {
  const { account, pair } = useCore();
  const date = DateTime.now().setZone(account.timezone).toISODate()!;
  const pairId = 'pairId' in pair ? pair.pairId : '';
  const query = useQuery({ queryKey: todayKeys.day(account.id, pairId, date),
    queryFn: () => getToday(pairId, date), enabled: pair.status === 'active' });
  if (pair.status !== 'active') return null;
  const names = { a: pair.members.find(member => member.slot === 'a')!.displayName, b: pair.members.find(member => member.slot === 'b')!.displayName };
  return <Screen title={`Hello, ${account.displayName}`} subtitle={DateTime.now().setZone(account.timezone).toLocaleString(DateTime.DATE_HUGE)}
    refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    <Button label="Add event" onPress={() => router.push('/events/new')} />
    <View style={ui.row}>{pair.members.map(member => <Badge key={member.userId} label={member.displayName} owner={member.slot} />)}</View>
    <View style={ui.card}>
      <Text accessibilityRole="header" style={theme.typography.section}>This week</Text>
      {query.isPending ? <Status message="Loading your plans…" /> : query.error ? <Status message="We could not load your plans." tone="error"
        actionLabel="Try again" onAction={() => { void query.refetch(); }} /> : query.data.agenda.length ? query.data.agenda.map(event =>
          <EventRow key={event.id} event={event} viewerTimezone={account.timezone} ownerNames={names}
            onPress={() => router.push({ pathname: '/events/[eventId]', params: { eventId: event.id } })} />)
        : <Text style={theme.typography.body}>Nothing planned for this week.</Text>}
      <Button label="View calendar" variant="text" onPress={() => router.push('/(tabs)/calendar')} />
    </View>
    <Button label="Your pair" variant="secondary" onPress={() => router.push('/settings/pair')} />
  </Screen>;
}
