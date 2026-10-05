import { Text, View } from 'react-native';
import { DateTime } from 'luxon';
import { Button } from '../../../components/ui/Button';
import { theme, ui } from '../../../theme';
import type { Memory } from '@deseo/domain/memories';
import { MemoryImage } from './MemoryImage';

export function MemoryCard({ memory, authorName, onOpen }: { memory: Memory; authorName: string; onOpen: () => void }) {
  const photo = memory.photos[0];
  return <View style={ui.card}>
    <Text style={theme.typography.section}>{DateTime.fromISO(memory.memoryDate).toLocaleString(DateTime.DATE_MED)}</Text>
    {photo && <MemoryImage photoId={photo.id} variant="thumb" width={photo.thumbWidth} height={photo.thumbHeight} />}
    {!!memory.caption && <Text style={theme.typography.body}>{memory.caption}</Text>}
    <Text style={theme.typography.secondary}>{authorName}</Text>
    <Button label="Open memory" variant="text" onPress={onOpen} />
  </View>;
}
