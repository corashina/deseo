import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Chips } from '../../../components/ui/Chips';
import { Countdown } from '../../../components/ui/Countdown';
import { IconButton } from '../../../components/ui/IconButton';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { makeStyles, useTheme } from '../../../theme';
import { useCore } from '../../pair';
import { EventRow } from '../components/EventRow';
import { useCalendarSignals } from '../realtime';
import { agendaDates, importantDateCountdown, nextImportantDate } from '@deseo/domain/calendar';
import { listImportantDates } from '../important-dates';
import { calendarKeys, listAgenda } from '../queries';
import type { Event, Owner } from '@deseo/domain/calendar';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ownerOf = (event: Event, self: 'a' | 'b'): Owner => event.who === 'private' ? self : event.who;
export function CalendarScreen() {
  const core = useCore();
  if (core.pair.status !== 'active') return <Screen title="Calendar"><Status message="Connect with your partner to open Calendar." /></Screen>;
  return <ActiveCalendar key={`${core.account.id}:${core.pair.pairId}`} account={core.account} pair={core.pair} online={core.online} refresh={core.refresh} />;
}

type Core = ReturnType<typeof useCore>;
function ActiveCalendar({ account, pair, online, refresh }: { account: Core['account']; pair: Extract<Core['pair'], { status: 'active' }>; online: boolean; refresh: Core['refresh'] }) {
  const theme = useTheme();
  const styles = useStyles();
  const router = useRouter();
  useCalendarSignals(account.id, pair.pairId, refresh);
  const today = DateTime.now().setZone(account.timezone).startOf('day');
  const datesRange = { pairId: pair.pairId, from: today.toISODate()!, to: today.plus({ days: 366 }).toISODate()! };
  const important = useQuery({ queryKey: [...calendarKeys.all(account.id, pair.pairId), 'important', datesRange.from, datesRange.to], queryFn: () => listImportantDates(pair.pairId, datesRange.from, datesRange.to) });
  const nextDate = nextImportantDate(important.data ?? [], account.timezone);
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
  const { groupsByDate, groups } = useMemo(() => {
    const values = new Map<string, NonNullable<typeof agenda.data>>();
    for (const event of agenda.data ?? []) {
      if (filter !== 'all' && ownerOf(event, viewerSlot) !== filter) continue;
      for (const date of agendaDates(event, account.timezone, from, to)) {
        const items = values.get(date) ?? [];
        items.push(event);
        values.set(date, items);
      }
    }
    return { groupsByDate: values, groups: [...values].sort(([a], [b]) => a.localeCompare(b)) };
  }, [agenda.data, filter, account.timezone, from, to]);
  const days = useMemo(() => Array.from({ length: month.daysInMonth! }, (_, index) => month.plus({ days: index }).toISODate()!), [month]);
  const visibleGroups = view === 'month' ? groups.filter(([date]) => date === selectedDate) : groups;
  const changeMonth = (delta: number) => {
    const next = month.plus({ months: delta });
    setMonth(next); setSelectedDate(next.toISODate()!);
  };
  const todayIso = DateTime.now().setZone(account.timezone).toISODate()!;
  const filters = (['all', viewerSlot, viewerSlot === 'a' ? 'b' : 'a', 'together'] as const).map(owner => ({ value: owner,
    owner: owner === 'all' ? undefined : owner,
    label: owner === 'all' ? 'Everyone' : owner === 'together' ? 'Together' : owner === viewerSlot ? `Me · ${names[owner]}` : names[owner] }));
  const countdown = nextDate?.temporal.kind === 'allDay' ? importantDateCountdown(nextDate.temporal.startDate, account.timezone) : null;
  return <Screen title="Calendar" action={<Button label="Add event" icon="add" compact onPress={() => router.push('/events/new')} />}
    refreshing={agenda.isRefetching} onRefresh={() => { void agenda.refetch(); void important.refetch(); }}>
    {!online && <Status tone="warning" message="You are offline. Refresh your calendar when you reconnect." />}
    {important.isError && <Status message="We could not load important dates." tone="error" actionLabel="Retry" onAction={() => { void important.refetch(); }} />}
    {nextDate && nextDate.temporal.kind === 'allDay' && countdown !== null && <Pressable accessibilityRole="button" accessibilityLabel={`Open important date: ${nextDate.title}`}
      onPress={() => router.push({ pathname: '/events/[eventId]', params: { eventId: nextDate.id } })} style={({ pressed }) => [theme.ui.card, pressed && styles.pressed]}>
      <Countdown days={countdown} title={nextDate.title} date={DateTime.fromISO(nextDate.temporal.startDate, { zone: account.timezone }).toLocaleString(DateTime.DATE_HUGE)} />
    </Pressable>}
    <Button label="Saved date ideas" variant="text" icon="bulb-outline" trailingIcon="chevron-forward" onPress={() => router.push('/ideas')} />
    <View style={styles.monthBar}>
      <IconButton icon="chevron-back" label="Previous month" onPress={() => changeMonth(-1)} />
      <Text accessibilityRole="header" style={[theme.typography.section, styles.monthTitle]}>{month.toLocaleString({ month: 'long', year: 'numeric' })}</Text>
      <IconButton icon="chevron-forward" label="Next month" onPress={() => changeMonth(1)} />
    </View>
    <Chips label="Calendar view" value={view} onChange={setView} options={[{ value: 'agenda', label: 'Agenda' }, { value: 'month', label: 'Month' }]} />
    <Chips label="Show events for" value={filter} onChange={setFilter} options={filters} />
    {view === 'month' && <View style={[theme.ui.card, styles.monthCard]}><View style={styles.grid}>
      {weekdays.map((day) => <Text key={day} style={[theme.typography.badge, styles.cell, styles.weekday]}>{day}</Text>)}
      {Array.from({ length: month.weekday - 1 }, (_, index) => <View key={`blank-${index}`} style={styles.cell} />)}
      {days.map((date) => {
        const events = groupsByDate.get(date);
        const selected = date === selectedDate;
        return <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${DateTime.fromISO(date).toLocaleString(DateTime.DATE_MED)}, ${events?.length ?? 0} events`} accessibilityState={{ selected }}
          style={styles.cell} onPress={() => setSelectedDate(date)}>
          {({ pressed }) => <View style={[styles.day, selected && styles.selected, pressed && !selected && styles.dayPressed]}>
            <Text style={[theme.typography.body, styles.dayNumber, date === todayIso && styles.today, selected && styles.selectedText]}>{Number(date.slice(-2))}</Text>
            <View style={styles.dots}>{events?.slice(0, 3).map(event => <View key={event.id} style={[styles.dot, { backgroundColor: theme.ownerTones[ownerOf(event, viewerSlot)].accent }]} />)}</View>
          </View>}
        </Pressable>;
      })}
    </View></View>}
    {agenda.isPending && <Status tone="loading" message="Loading calendar…" />}
    {agenda.isError && <Status tone="error" message="We could not load your calendar." actionLabel="Retry" onAction={() => { void agenda.refetch(); }} />}
    {!agenda.isPending && !agenda.isError && visibleGroups.length === 0 && <Status message={view === 'month'
      ? `Nothing planned for ${DateTime.fromISO(selectedDate).toLocaleString(DateTime.DATE_MED)}.` : 'No events this month.'} actionLabel="Add event" onAction={() => router.push('/events/new')} />}
    {visibleGroups.map(([date, events]) => <View key={date} style={styles.dayGroup}>
      <Text accessibilityRole="header" style={[theme.typography.headline, date === todayIso && styles.today]}>
        {date === todayIso ? 'Today · ' : ''}{DateTime.fromISO(date, { zone: 'UTC' }).toLocaleString({ weekday: 'long', month: 'long', day: 'numeric' })}
      </Text>
      {events.map((event) => <EventRow key={event.id} event={event} viewerTimezone={account.timezone} ownerNames={names}
        onPress={() => router.push({ pathname: '/events/[eventId]', params: { eventId: event.id } })} />)}
    </View>)}
  </Screen>;
}
const useStyles = makeStyles(theme => ({
  pressed: { backgroundColor: theme.colors.sidebar },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -theme.space[2] },
  monthTitle: { flex: 1, textAlign: 'center' },
  monthCard: { paddingHorizontal: theme.space[2], paddingVertical: theme.space[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285714%', minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  weekday: { minHeight: 28, textAlign: 'center', color: theme.colors.muted },
  day: { width: 44, height: 48, borderRadius: theme.radius.control, alignItems: 'center', justifyContent: 'center', gap: 2,
    borderWidth: 1, borderColor: 'transparent' },
  dayPressed: { backgroundColor: theme.colors.sidebar },
  selected: { backgroundColor: theme.colors.action, borderColor: theme.colors.actionBorder },
  dayNumber: { fontVariant: ['tabular-nums'] },
  today: { color: theme.colors.link, fontWeight: '700' },
  selectedText: { color: theme.colors.onAction, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dayGroup: { gap: theme.space[2], paddingTop: theme.space[2] },
}));
