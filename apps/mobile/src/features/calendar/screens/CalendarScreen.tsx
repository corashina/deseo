import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { theme, ui } from '../../../theme';
import { useCore } from '../../pair';
import { EventRow } from '../components/EventRow';
import { agendaDates, calendarKeys, listAgenda } from '../queries';
import type { Owner } from '../types';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function CalendarScreen() {
  const core = useCore();
  if (core.pair.status !== 'active') return <Screen title="Calendar"><Status message="Connect with your partner to open Calendar." /></Screen>;
  return <ActiveCalendar key={`${core.account.id}:${core.pair.pairId}`} account={core.account} pair={core.pair} online={core.online} />;
}

type Core = ReturnType<typeof useCore>;
function ActiveCalendar({ account, pair, online }: { account: Core['account']; pair: Extract<Core['pair'], { status: 'active' }>; online: boolean }) {
  const router = useRouter();
  const [month, setMonth] = useState(() => DateTime.now().setZone(account.timezone).startOf('month'));
  const [view, setView] = useState<'agenda' | 'month'>('agenda');
  const [selectedDate, setSelectedDate] = useState(() => DateTime.now().setZone(account.timezone).toISODate()!);
  const [filter, setFilter] = useState<Owner | 'all'>('all');
  const from = month.toISODate()!;
  const to = month.plus({ months: 1 }).toISODate()!;
  // Pair-zone query boundaries need one adjacent day for viewers in another zone.
  const range = { pairId: pair.pairId, from: month.minus({ days: 1 }).toISODate()!, to: month.plus({ months: 1, days: 1 }).toISODate()! };
  const agenda = useQuery({ queryKey: calendarKeys.agenda(account.id, range), queryFn: () => listAgenda(range) });
  const names = { a: pair.members.find((member) => member.slot === 'a')!.displayName, b: pair.members.find((member) => member.slot === 'b')!.displayName };
  const viewerSlot = pair.members.find((member) => member.userId === account.id)!.slot;
  const groups = useMemo(() => {
    const values = new Map<string, NonNullable<typeof agenda.data>>();
    for (const event of agenda.data ?? []) {
      if (filter !== 'all' && event.owner !== filter) continue;
      for (const date of agendaDates(event, account.timezone, from, to)) {
        const items = values.get(date) ?? [];
        items.push(event);
        values.set(date, items);
      }
    }
    return [...values].sort(([a], [b]) => a.localeCompare(b));
  }, [agenda.data, filter, account.timezone, from, to]);
  const days = Array.from({ length: month.daysInMonth! }, (_, index) => month.plus({ days: index }).toISODate()!);
  const visibleGroups = view === 'month' ? groups.filter(([date]) => date === selectedDate) : groups;
  const changeMonth = (delta: number) => {
    const next = month.plus({ months: delta });
    setMonth(next); setSelectedDate(next.toISODate()!);
  };
  return <Screen title="Calendar" refreshing={agenda.isRefetching} onRefresh={() => { void agenda.refetch(); }}>
    {!online && <Status message="You are offline. Refresh your calendar when you reconnect." />}
    <Button label="Add event" onPress={() => router.push('/events/new')} />
    <View style={ui.row}>
      <Button label="Previous month" variant="text" onPress={() => changeMonth(-1)} />
      <Text accessibilityRole="header" style={theme.typography.section}>{month.toLocaleString({ month: 'long', year: 'numeric' })}</Text>
      <Button label="Next month" variant="text" onPress={() => changeMonth(1)} />
    </View>
    <View style={ui.row}>
      <Button label="Agenda" variant={view === 'agenda' ? 'primary' : 'secondary'} onPress={() => setView('agenda')} />
      <Button label="Month" variant={view === 'month' ? 'primary' : 'secondary'} onPress={() => setView('month')} />
    </View>
    <View style={ui.row}>
      {(['all', viewerSlot, viewerSlot === 'a' ? 'b' : 'a', 'together'] as const).map((owner) => <Button key={owner}
        label={owner === 'all' ? 'All' : owner === 'together' ? 'Together' : owner === viewerSlot ? `Me · ${names[owner]}` : `Partner · ${names[owner]}`}
        variant={filter === owner ? 'primary' : 'secondary'} onPress={() => setFilter(owner)} />)}
    </View>
    {view === 'month' && <ScrollView horizontal contentContainerStyle={styles.monthScroll}><View style={styles.grid}>
      {weekdays.map((day) => <Text key={day} style={[theme.typography.secondary, styles.cell]}>{day}</Text>)}
      {Array.from({ length: month.weekday - 1 }, (_, index) => <View key={`blank-${index}`} style={styles.cell} />)}
      {days.map((date) => {
        const count = groups.find(([groupDate]) => groupDate === date)?.[1].length ?? 0;
        return <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${date}, ${count} events`} accessibilityState={{ selected: date === selectedDate }}
          style={[styles.cell, styles.day, date === selectedDate && styles.selected]} onPress={() => setSelectedDate(date)}>
          <Text style={theme.typography.body}>{Number(date.slice(-2))}</Text>
          <Text style={theme.typography.secondary}>{count > 0 ? count : ''}</Text>
        </Pressable>;
      })}
    </View></ScrollView>}
    {agenda.isPending && <Status message="Loading your calendar…" />}
    {agenda.isError && <Status tone="error" message="We could not load your calendar." actionLabel="Retry" onAction={() => { void agenda.refetch(); }} />}
    {!agenda.isPending && !agenda.isError && visibleGroups.length === 0 && <Status message={view === 'month' ? `Nothing planned for ${selectedDate}.` : 'No events this month.'} actionLabel="Add event" onAction={() => router.push('/events/new')} />}
    {visibleGroups.map(([date, events]) => <View key={date} style={ui.stack}>
      <Text accessibilityRole="header" style={theme.typography.section}>{DateTime.fromISO(date, { zone: 'UTC' }).toLocaleString(DateTime.DATE_HUGE)}</Text>
      {events.map((event) => <EventRow key={event.id} event={event} viewerTimezone={account.timezone} ownerNames={names}
        onPress={() => router.push({ pathname: '/events/[eventId]', params: { eventId: event.id } })} />)}
    </View>)}
  </Screen>;
}
const styles = StyleSheet.create({
  monthScroll: { flexGrow: 1 }, grid: { minWidth: 336, flex: 1, flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: '14.285714%', minHeight: 48, textAlign: 'center', alignItems: 'center', justifyContent: 'center' },
  day: { borderWidth: 1, borderColor: theme.colors.control, borderRadius: theme.radius.badge },
  selected: { backgroundColor: theme.colors.action, borderColor: theme.colors.actionBorder },
});
