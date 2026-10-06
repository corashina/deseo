import { Ionicons } from '@expo/vector-icons';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import type { IconName } from './Button';

/** One fact on a detail screen: an icon, the value, and optional smaller lines below it. */
export function DetailRow({ icon, children, note }: PropsWithChildren<{ icon: IconName; note?: string | (string | false | null | undefined)[] }>) {
  const notes = (Array.isArray(note) ? note : [note]).filter((line): line is string => !!line);
  return <View style={styles.row}>
    <Ionicons name={icon} size={20} color={theme.colors.muted} style={styles.icon} />
    <View style={styles.text}>
      {typeof children === 'string' ? <Text style={theme.typography.body}>{children}</Text> : children}
      {notes.map(line => <Text key={line} style={theme.typography.secondary}>{line}</Text>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.space[3], alignItems: 'flex-start' },
  icon: { marginTop: 2 },
  text: { flex: 1, gap: 2 },
});
