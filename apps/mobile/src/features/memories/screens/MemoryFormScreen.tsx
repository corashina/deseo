import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCore } from '../../pair';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Status } from '../../../components/ui/Status';
import { theme, ui } from '../../../theme';
import { toAppError } from '../../../lib/result';
import { memoryKeys, getMemory } from '../queries';
import { photoFile } from '../drafts';
import { changeMemoryDraft, clearMemoryCompletion, discardCurrentMemoryDraft, getMemoryLifecycle, openMemoryDraft, pickMemoryPhotos,
  restartMemoryDraft, reviewMemoryConflict, submitMemoryDraft, subscribeMemoryLifecycle } from '../lifecycle';
import type { Memory } from '../types';

export function MemoryFormScreen({ memoryId }: { memoryId?: string }) {
  const { account, pair, online } = useCore();
  const pairId = 'pairId' in pair ? pair.pairId : '';
  const query = useQuery({ queryKey: memoryKeys.detail(account.id, pairId, memoryId ?? 'new'),
    queryFn: () => getMemory(pairId, memoryId!), enabled: !!memoryId && pair.status === 'active' });
  if (memoryId && query.isPending) return <Screen title="Edit memory"><Status message="Loading memory…" /></Screen>;
  if (memoryId && (query.isError || !query.data)) return <Screen title="Edit memory"><Status message="This memory is unavailable." /></Screen>;
  if (memoryId && query.data?.createdBy !== account.id) return <Screen title="Memory"><Status message="Only the author can edit this memory." /></Screen>;
  return <Form memory={query.data} timezone={account.timezone} online={online} reload={async () => (await query.refetch()).data} />;
}
function Form({ memory, timezone, online, reload }: { memory?: Memory; timezone: string; online: boolean; reload: () => Promise<Memory | undefined> }) {
  const access = useSyncExternalStore(subscribeMemoryLifecycle, getMemoryLifecycle);
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Memory | null>(null);
  const key = memory ? `memories:edit:${memory.id}` : 'memories:new';
  const draft = access.drafts[key];
  useEffect(() => () => { clearMemoryCompletion(); }, []);
  useEffect(() => {
    if (access.status !== 'ready') return;
    void openMemoryDraft(timezone, memory).catch(error => setLocalError(toAppError(error).message));
  }, [key, access.generation, access.status]);
  const run = (action: () => Promise<void>) => { setLocalError(null); void action().catch(error => setLocalError(toAppError(error).message)); };
  if (access.completedId) return <Screen title="Memory saved"><Status message="Both partners can open this memory." />
    {access.error && <Status tone="error" message={access.error} />}
    <Button label="Open memory" onPress={() => router.replace({ pathname: '/memories/[memoryId]', params: { memoryId: access.completedId! } })} />
  </Screen>;
  if (!draft || access.status !== 'ready') return <Screen title={memory ? 'Edit memory' : 'Add memory'}>
    <Status message={localError ?? 'Opening your draft…'} />
  </Screen>;
  const locked = access.busy || draft.submitted;
  return <Screen title={memory ? 'Edit memory' : 'Add memory'}>
    {!online && <Status message="You are offline. Your draft stays on this device. Reconnect before you upload." />}
    {(access.error || localError) && <Status tone="error" message={localError ?? access.error!} />}
    {draft.submitted && !draft.conflict && <Status message="Your last save needs confirmation. Tap Retry save to continue." />}
    <Field label="Memory date" hint="Use YYYY-MM-DD." value={draft.memoryDate} editable={!locked} maxLength={10}
      onChangeText={memoryDate => changeMemoryDraft(key, { memoryDate })} />
    <Field label="Caption (optional)" value={draft.caption} editable={!locked} multiline maxLength={1000}
      onChangeText={caption => changeMemoryDraft(key, { caption })} />
    {!memory && <>
      {draft.photos.map((photo, index) => <View key={photo.id} style={ui.card}>
        {photo.status !== 'missing' && <Image source={{ uri: photoFile(draft.draftId, photo.id, 'thumb').uri }} cachePolicy="memory"
          style={{ width: '100%', aspectRatio: 1.4 }} contentFit="cover" accessibilityLabel={`Selected photo ${index + 1}`} />}
        <Text style={theme.typography.body}>Photo {index + 1}: {photo.status === 'ready' ? 'Ready to upload' : photo.status === 'uploading' ? 'Uploading' : photo.status === 'validated' ? 'Uploaded' : photo.status === 'missing' ? 'Select this photo again' : 'Upload failed'}</Text>
        <Button label={`Remove photo ${index + 1}`} variant="secondary" disabled={access.busy || (draft.submitted && !online)}
          onPress={() => run(() => restartMemoryDraft(photo.id))} />
      </View>)}
      <Button label="Select photos" disabled={locked || draft.reserved || draft.photos.length >= 5} loading={access.busy && !draft.submitted}
        onPress={() => run(pickMemoryPhotos)} />
      {draft.submitted && <Button label="Start a new upload" variant="secondary" disabled={access.busy || !online}
        onPress={() => run(() => restartMemoryDraft())} />}
      {draft.submitted && <Status message="If this upload expired, start a new upload. Your caption and selected photos stay in the draft." />}
    </>}
    {draft.conflict && <Status tone="error" message="This memory changed. Your caption and date remain in this draft."
      actionLabel="Review saved version" onAction={() => run(async () => { const result = await reload(); if (result) setSaved(result); })} />}
    {saved && <View style={ui.card}><Text style={theme.typography.section}>Saved version</Text>
      <Text style={theme.typography.body}>{saved.memoryDate}</Text><Text style={theme.typography.body}>{saved.caption || 'No caption'}</Text>
      <Button label="Keep my draft" onPress={() => run(async () => { await reviewMemoryConflict(saved); setSaved(null); })} />
    </View>}
    <Button label={draft.submitted ? 'Retry save' : memory ? 'Save changes' : 'Save memory'} loading={access.busy}
      disabled={access.busy || !online || draft.conflict || (!memory && draft.photos.length === 0)} onPress={() => run(() => submitMemoryDraft(key))} />
    <Button label="Close" variant="secondary" disabled={access.busy} onPress={() => router.back()} />
    <Button label="Discard draft" variant="danger" disabled={access.busy} onPress={() => Alert.alert('Discard this draft?',
      'You will remove its caption and temporary photos from this device.', [{ text: 'Cancel', style: 'cancel' },
        { text: 'Discard draft', style: 'destructive', onPress: () => run(async () => { await discardCurrentMemoryDraft(key); router.back(); }) }])} />
  </Screen>;
}
