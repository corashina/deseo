import { DateTime } from 'luxon';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { makeStyles, useTheme } from '../../../theme';
import type { Message } from '@deseo/domain/messages';

export type NoteCardProps = { message: Message; authorName: string; timezone: string; locale: string; onReply(): void; onOpen?(): void };
export function NoteCard({ message, authorName, timezone, locale, onReply, onOpen }: NoteCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  return <View style={styles.card}>
    <View style={styles.from}>
      <Ionicons name="pin-outline" size={14} color={theme.colors.muted} />
      <Text style={[theme.typography.secondary, styles.author]}>Note from {authorName}</Text>
    </View>
    <Text numberOfLines={3} style={theme.typography.body}>{message.body}</Text>
    <Text style={[theme.typography.secondary, styles.timestamp]}>
      Pinned {DateTime.fromISO(message.pinnedAt ?? message.createdAt).setZone(timezone).setLocale(locale).toLocaleString(DateTime.DATETIME_MED)}
    </Text>
    <View style={styles.actions}>
      {onOpen && <Button label="Read note" variant="text" onPress={onOpen} />}
      <Button label="Reply" variant="text" onPress={onReply} />
    </View>
  </View>;
}
const useStyles = makeStyles(theme => ({
  card: { backgroundColor: theme.colors.note, borderColor: theme.colors.noteLine, borderWidth: 1,
    borderRadius: theme.radius.card, padding: theme.space[6], gap: theme.space[3] },
  from: { flexDirection: 'row', alignItems: 'center', gap: theme.space[1] },
  author: { flex: 1, fontWeight: '600' }, timestamp: { fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.space[4] },
}));
