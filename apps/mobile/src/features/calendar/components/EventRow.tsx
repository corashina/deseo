import { Ionicons } from '@expo/vector-icons';
import { DateTime } from 'luxon';
import { Pressable, Text, View } from 'react-native';
import { makeStyles, useTheme } from '../../../theme';
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
  const theme = useTheme();
  const styles = useStyles();
  const ownerName = event.owner === 'together' ? 'Together' : ownerNames[event.owner];
  const temporal = event.temporal;
  const time = temporal.kind === 'allDay' ? 'All day' : DateTime.fromISO(temporal.startsAt).setZone(viewerTimezone).toLocaleString(DateTime.TIME_SIMPLE);
  const tone = theme.ownerTones[event.owner];
  const body = <>
    <Text style={theme.typography.headline}>{event.title}</Text>
    <View style={styles.metadata}>
      <Text style={[theme.typography.badge, { color: tone.color }]}>{ownerName}</Text>
      {event.importantDate && <View style={styles.meta}><Ionicons name="star-outline" size={14} color={theme.colors.muted} /><Text style={theme.typography.secondary}>Important date{event.repeat === 'yearly' ? ' · Yearly' : ''}</Text></View>}
      {event.visibility === 'private' && <View style={styles.meta}><Ionicons name="lock-closed-outline" size={14} color={theme.colors.muted} /><Text style={theme.typography.secondary}>Private</Text></View>}
    </View>
    {event.location ? <View style={styles.meta}><Ionicons name="location-outline" size={14} color={theme.colors.muted} /><Text style={theme.typography.secondary}>{event.location}</Text></View> : null}
  </>;
  const tint = [styles.body, { backgroundColor: tone.soft, borderColor: tone.accent }];
  return <View style={styles.row}>
    <Text style={[theme.typography.secondary, styles.time]}>{time}</Text>
    {onPress
      ? <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}. ${eventDateLabel(event, viewerTimezone)}. ${ownerName}. ${event.visibility}`}
        onPress={onPress} style={({ pressed }) => [tint, pressed && styles.pressed]}>{body}</Pressable>
      : <View style={tint}>{body}</View>}
  </View>;
}

const useStyles = makeStyles(theme => ({
  row: { flexDirection: 'row', gap: theme.space[3] },
  time: { width: 64, paddingTop: theme.space[3], fontVariant: ['tabular-nums'] },
  body: { flex: 1, gap: theme.space[1], minHeight: theme.touchTarget, paddingVertical: theme.space[3], paddingHorizontal: theme.space[4],
    borderRadius: theme.radius.control, borderWidth: 1 },
  pressed: { opacity: 0.75 },
  metadata: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: theme.space[3], rowGap: theme.space[1] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: theme.space[1] },
}));
