import { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { DateTime } from 'luxon';
import { randomUUID } from 'expo-crypto';
import { useCore } from '../../pair';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { theme, ui } from '../../../theme';
import { captureQueryScope, queryClient } from '../../../lib/query-client';
import { toAppError } from '@deseo/domain/result';
import { getMemory, memoryKeys } from '../queries';
import { deleteMemory } from '../commands';
import { MemoryImage } from '../components/MemoryImage';
import { saveMemoryCopy } from '../save-copy';

export function MemoryDetailScreen({ memoryId }: { memoryId: string }) {
  const { account, pair, online } = useCore();
  const router = useRouter();
  const pairId = 'pairId' in pair ? pair.pairId : '';
  const query = useQuery({ queryKey: memoryKeys.detail(account.id, pairId, memoryId), queryFn: () => getMemory(pairId, memoryId), enabled: pair.status === 'active' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const command = useRef(randomUUID());
  const memory = query.data;
  const remove = async () => {
    if (!memory || busy || memory.createdBy !== account.id) return;
    const scope = captureQueryScope(); setBusy(true); setError(null);
    try {
      const result = await deleteMemory(memory.id, memory.version, command.current);
      scope.assertCurrent();
      if (!result.ok) { setError(toAppError(result.error).message); return; }
      queryClient.removeQueries({ queryKey: memoryKeys.all(account.id, pairId) });
      router.replace('/(tabs)/memories');
    } catch (failure) { if (!scope.signal.aborted) setError(toAppError(failure).message); }
    finally { if (!scope.signal.aborted) setBusy(false); }
  };
  const save = async (photoId: string) => {
    setBusy(true); setError(null); setNotice(null);
    try { await saveMemoryCopy(photoId); setNotice('You saved a copy to your photo library.'); }
    catch (failure) { setError(toAppError(failure).message); }
    finally { setBusy(false); }
  };
  return <Screen title="Memory">
    {!online && <Status message="You are offline. Reconnect to load this memory." />}
    {query.isFetching && <Status message="Loading memory…" />}
    {query.isError && <Status tone="error" message="This memory is unavailable." actionLabel="Retry" onAction={() => { void query.refetch(); }} />}
    {error && <Status tone="error" message={error} actionLabel="Reload memory" onAction={() => { command.current = randomUUID(); void query.refetch(); }} />}
    {notice && <Status message={notice} />}
    {memory && !query.isError && !query.isFetching && <>
      <Text style={theme.typography.section}>{DateTime.fromISO(memory.memoryDate).toLocaleString(DateTime.DATE_FULL)}</Text>
      <Text style={theme.typography.secondary}>{pair.status === 'active' ? pair.members.find(member => member.userId === memory.createdBy)?.displayName : ''}</Text>
      {!!memory.caption && <Text style={theme.typography.body}>{memory.caption}</Text>}
      {memory.photos.map((photo, index) => <View key={photo.id} style={ui.stack}>
        <MemoryImage photoId={photo.id} variant="full" width={photo.width} height={photo.height} />
        <Button label={`Save photo ${index + 1}`} variant="secondary" disabled={busy || !online} onPress={() => Alert.alert('Save a copy?',
          'Library copies remain after you delete this memory or disconnect.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Save copy', onPress: () => { void save(photo.id); } }])} />
      </View>)}
      {memory.createdBy === account.id && <>
        <Button label="Edit memory" disabled={busy || !online} onPress={() => router.push({ pathname: '/memories/[memoryId]/edit', params: { memoryId } })} />
        <Button label="Delete memory" variant="danger" loading={busy} disabled={!online} onPress={() => Alert.alert('Delete this memory?',
          'Both partners will lose access. Library copies remain.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete memory', style: 'destructive', onPress: () => { void remove(); } }])} />
      </>}
    </>}
  </Screen>;
}
