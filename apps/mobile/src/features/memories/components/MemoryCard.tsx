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
  return <View style={[theme.ui.card, styles.card]}>
    {photo && <MemoryImage photoId={photo.id} variant="thumb" width={photo.thumbWidth} height={photo.thumbHeight} onOpen={onOpen} />}
    <Pressable accessibilityRole="button" accessibilityLabel={`Open memory. ${memory.caption || date}. ${authorName}, ${date}`}
    onPress={onOpen} style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
    <View style={styles.text}>
      {!!memory.caption && <Text style={theme.typography.headline}>{memory.caption}</Text>}
      <Text style={theme.typography.secondary}>{authorName} · {date}</Text>
    </View>
  </Pressable></View>;
}

const useStyles = makeStyles(theme => ({
  card: { padding: 0, gap: 0, overflow: 'hidden' },
  open: { minHeight: theme.touchTarget, borderRadius: theme.radius.card },
  pressed: { backgroundColor: theme.colors.sidebar },
  text: { gap: theme.space[2], padding: theme.space[6] },
}));
