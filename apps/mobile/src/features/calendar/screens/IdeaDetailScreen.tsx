import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Alert, Linking, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Screen } from '../../../components/ui/Screen';
import { Status } from '../../../components/ui/Status';
import { useTheme } from '../../../theme';
import { captureQueryScope } from '../../../lib/query-client';
import type { CommandError } from '@deseo/domain/result';
import { useCore } from '../../pair';
import { CalendarAccess } from '../CalendarAccess';
import { ideaFieldsSchema } from '@deseo/domain/calendar';
import { archiveIdea, getDateIdea, ideaKeys } from '../date-ideas';
import { readArchiveIntent, writeArchiveIntent, removeArchiveIntent, type ArchiveIntent } from '../archive-intent';
import { useCalendarSignals } from '../realtime';
export function IdeaDetailScreen({ ideaId }: { ideaId: string }) { return <CalendarAccess><Entry ideaId={ideaId} /></CalendarAccess>; }
function Entry({ ideaId }: { ideaId: string }) {
  const core = useCore(); const pairId = core.pair.status === 'active' ? core.pair.pairId : '';
  return <Detail key={`${core.account.id}:${pairId}:${ideaId}`} ideaId={ideaId} pairId={pairId} />;
}
function Detail({ ideaId, pairId }: { ideaId: string; pairId: string }) {
  const theme = useTheme();
  const core = useCore(); const router = useRouter(); const key = `calendar:idea-archive:${ideaId}`;
  useCalendarSignals(core.account.id, pairId, core.refresh);
  const query = useQuery({ queryKey: ideaKeys.detail(core.account.id, pairId, ideaId), queryFn: () => getDateIdea(pairId, ideaId) });
  const [intent, setIntent] = useState<ArchiveIntent | null>(null); const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false); const busy = useRef(false); const [error, setError] = useState<CommandError | null>(null);
  useEffect(() => {
    let active = true; const scope = captureQueryScope();
    void readArchiveIntent(core.account.id, pairId, key).then(value => {
      scope.assertCurrent(); if (!active) return;
      if (value && value.id !== ideaId) throw new Error('The archive request changed.');
      if (value) { setIntent(value); setError({ code: 'RETRYABLE', message: 'Confirm your last archive request.' }); }
      setReady(true);
    }).catch(() => { if (active) setError({ code: 'RETRYABLE', message: 'We could not open your archive request. Open this screen again.' }); });
    return () => { active = false; };
  }, [core.account.id, pairId, key, ideaId]);
  const archive = async (next: ArchiveIntent) => {
    if (busy.current || !ready || !core.online) return;
    const scope = captureQueryScope(); busy.current = true; setSaving(true); setIntent(next); setError(null);
    try {
      await writeArchiveIntent(core.account.id, pairId, key, next); scope.assertCurrent();
      const result = await archiveIdea(next.id, next.expectedVersion, next.commandId); scope.assertCurrent();
      if (result.ok || result.error.code !== 'RETRYABLE') { await removeArchiveIntent(core.account.id, pairId, key); scope.assertCurrent(); setIntent(null); }
      if (!result.ok) setError(result.error);
    } catch { try { scope.assertCurrent(); setError({ code: 'RETRYABLE', message: 'We could not confirm archiving. Retry when connected.' }); } catch { /* The gate owns recovery. */ } }
    finally { busy.current = false; try { scope.assertCurrent(); setSaving(false); } catch { /* The gate owns recovery. */ } }
  };
  const retry = error && <Status tone="error" message={error.code === 'CONFLICT' ? 'Your partner changed this idea. Reload it before you archive it.' : error.message ?? 'We could not archive this idea.'}
    actionLabel={intent ? 'Retry archive' : 'Reload saved version'} onAction={intent ? () => { void archive(intent); } : () => { const scope = captureQueryScope(); void query.refetch().then(() => { scope.assertCurrent(); setError(null); }); }} />;
  if (query.isPending) return <Screen title="Idea"><Status tone="loading" message="Loading idea…" /></Screen>;
  if (query.isError) return <Screen title="Idea"><Status tone="error" message="We could not load this idea." actionLabel="Retry" onAction={() => { void query.refetch(); }} />{retry}</Screen>;
  const idea = query.data;
  if (!idea) return <Screen title="Idea"><Status message="This idea is unavailable." />{retry}</Screen>;
  return <Screen title={idea.title} refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    {!core.online && <Status tone="warning" message="You are offline. Reconnect before you plan or archive this idea." />}
    <View style={theme.ui.card}>
      <Text style={theme.typography.body}>{idea.state === 'saved' ? 'Saved' : idea.state === 'planned' ? 'Planned' : 'Archived'}</Text>
      {idea.note ? <Text style={theme.typography.body}>{idea.note}</Text> : null}
      {idea.link && <Button label="Open link" variant="text" onPress={() => {
        if (!ideaFieldsSchema.safeParse(idea).success) { setError({ code: 'VALIDATION', message: 'This link is invalid.' }); return; }
        void Linking.openURL(idea.link).catch(() => setError({ code: 'RETRYABLE', message: 'We could not open this link.' }));
      }} />}
      {retry}
      {idea.state === 'saved' && <Button label="Plan date" disabled={saving || !!intent} onPress={() => router.push({ pathname: '/events/new', params: { ideaId } })} />}
      {idea.linkedEventId && <Button label="Open planned event" variant="secondary" onPress={() => router.push({ pathname: '/events/[eventId]', params: { eventId: idea.linkedEventId! } })} />}
      <Button label="Edit idea" variant="secondary" disabled={saving || !!intent} onPress={() => router.push({ pathname: '/ideas/[ideaId]/edit', params: { ideaId } })} />
      {idea.state !== 'archived' && <Button label="Archive idea" variant="secondary" loading={saving} disabled={!core.online || !ready || !!intent || error?.code === 'CONFLICT'} onPress={() => Alert.alert(`Archive ${idea.title}?`, 'You can find this idea in Archived.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Archive idea', onPress: () => { void archive({ id: ideaId, expectedVersion: idea.version, commandId: randomUUID() }); } },
      ])} />}
    </View>
  </Screen>;
}
