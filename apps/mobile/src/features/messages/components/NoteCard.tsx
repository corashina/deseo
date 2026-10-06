import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { theme } from '../../../theme';
import type { Message } from '../types';

export type NoteCardProps = { message: Message; authorName: string; onReply(): void; onOpen?(): void };
export function NoteCard({ message, authorName, onReply, onOpen }: NoteCardProps) {
  return <View style={styles.card}>
    <View style={styles.from}>
      <Ionicons name="pin-outline" size={14} color={theme.colors.muted} />
      <Text style={theme.typography.secondary}>Note from {authorName}</Text>
    </View>
    <Text numberOfLines={3} style={theme.typography.body}>{message.body}</Text>
    <View style={styles.actions}>
      {onOpen && <Button label="Read note" variant="text" onPress={onOpen} />}
      <Button label="Reply" variant="text" onPress={onReply} />
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.note, borderColor: theme.colors.noteLine, borderWidth: 1,
    borderRadius: theme.radius.card, paddingHorizontal: theme.space[5], paddingTop: theme.space[4], paddingBottom: theme.space[1], gap: theme.space[2] },
  from: { flexDirection: 'row', alignItems: 'center', gap: theme.space[1] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.space[4] },
});
