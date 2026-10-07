import { Pressable, Text, View } from 'react-native';
import { DateTime } from 'luxon';
import { makeStyles, useTheme } from '../../../theme';
import type { Memory } from '@deseo/domain/memories';
import { MemoryImage } from './MemoryImage';

export function MemoryCard({ memory, authorName, onOpen }: { memory: Memory; authorName: string; onOpen: () => void }) {
  const theme = useTheme();
  const styles = useStyles();
  const photo = memory.photos[0];
  const date = DateTime.fromISO(memory.memoryDate).toLocaleString(DateTime.DATE_MED);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open memory. ${memory.caption || date}. ${authorName}, ${date}`}
    onPress={onOpen} style={({ pressed }) => [theme.ui.card, styles.card, pressed && styles.pressed]}>
    {photo && <MemoryImage photoId={photo.id} variant="thumb" width={photo.thumbWidth} height={photo.thumbHeight} />}
    <View style={styles.text}>
      {!!memory.caption && <Text style={theme.typography.body}>{memory.caption}</Text>}
      <Text style={theme.typography.secondary}>{authorName} · {date}</Text>
    </View>
  </Pressable>;
}

const useStyles = makeStyles(theme => ({
  card: { padding: theme.space[3] },
  pressed: { backgroundColor: theme.colors.sidebar },
  text: { gap: theme.space[1], paddingHorizontal: theme.space[1], paddingBottom: theme.space[1] },
}));
