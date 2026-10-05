import { Ionicons } from '@expo/vector-icons';
import { DateTime } from 'luxon';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { theme } from '../../../theme';
import { inclusiveEndDate } from '@deseo/domain/calendar';
import type { AgendaItem } from '@deseo/domain/calendar';

export type EventRowProps = {
  event: AgendaItem;
  viewerTimezone: string;
  ownerNames: Record<'a' | 'b', string>;
  onPress?: () => void;
};

export function eventDateLabel(event: AgendaItem, timezone: string): string {
  const temporal = event.temporal;
  if (temporal.kind === 'allDay') {
    const start = DateTime.fromISO(temporal.startDate, { zone: 'UTC' }).toLocaleString(DateTime.DATE_MED);
    const last = inclusiveEndDate(temporal.endDateExclusive);
    return last === temporal.startDate ? start : `${start} – ${DateTime.fromISO(last, { zone: 'UTC' }).toLocaleString(DateTime.DATE_MED)}`;
  }
  const start = DateTime.fromISO(temporal.startsAt).setZone(timezone);
  const end = DateTime.fromISO(temporal.endsAt).setZone(timezone);
  return `${start.toLocaleString(DateTime.DATETIME_MED)} – ${end.toLocaleString(start.hasSame(end, 'day') ? DateTime.TIME_SIMPLE : DateTime.DATETIME_MED)}`;
}

export function EventRow({ event, viewerTimezone, ownerNames, onPress }: EventRowProps) {
  const ownerName = event.owner === 'together' ? 'Together' : ownerNames[event.owner];
  const temporal = event.temporal;
  const time = temporal.kind === 'allDay' ? 'All day' : DateTime.fromISO(temporal.startsAt).setZone(viewerTimezone).toLocaleString(DateTime.TIME_SIMPLE);
  const content = <>
    <Text style={[theme.typography.secondary, styles.time]}>{time}</Text>
    <View style={styles.body}>
      <Text style={theme.typography.section}>{event.title}</Text>
      <View style={styles.metadata}>
        <Badge owner={event.owner} label={ownerName} />
        {event.importantDate && <Text style={theme.typography.secondary}>Important date{event.repeat === 'yearly' ? ' · Yearly' : ''}</Text>}
        {event.visibility === 'private' && <View style={styles.metadata}><Ionicons name="lock-closed-outline" size={16} color={theme.colors.muted} /><Text style={theme.typography.secondary}>Private</Text></View>}
      </View>
      {event.location ? <Text style={theme.typography.secondary}>{event.location}</Text> : null}
    </View>
  </>;
  const backgroundColor = event.owner === 'a' ? theme.colors.roseSoft : event.owner === 'b' ? theme.colors.tealSoft : theme.colors.sharedSoft;
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}. ${eventDateLabel(event, viewerTimezone)}. ${ownerName}. ${event.visibility}`} onPress={onPress} style={[styles.row, { backgroundColor }]}>{content}</Pressable>
    : <View style={[styles.row, { backgroundColor }]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.space[3], padding: theme.space[4], borderRadius: theme.radius.card, minHeight: 48 },
  time: { width: 68, fontVariant: ['tabular-nums'] }, body: { flex: 1, gap: theme.space[2] },
  metadata: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.space[2] },
});
