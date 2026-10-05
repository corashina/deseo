import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../theme';
import type { Message } from '@deseo/domain/messages';

export type NoteCardProps = { message: Message; authorName: string; onReply(): void; onOpen?(): void };
export function NoteCard({ message, authorName, onReply, onOpen }: NoteCardProps) {
  return <View style={styles.card}>
    <Text style={theme.typography.secondary}>Note from {authorName}</Text>
    <Text numberOfLines={3} style={theme.typography.body}>{message.body}</Text>
    <View style={styles.actions}>
      {onOpen && <Button label="Read note" variant="text" onPress={onOpen} />}
      <Button label="Reply" variant="text" onPress={onReply} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.note, borderColor: theme.colors.noteLine, borderWidth: 1,
    borderRadius: theme.radius.card, padding: 12, gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
