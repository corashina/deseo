import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { DateTime } from 'luxon';
import { RowGroup } from '../../../components/ui/RowGroup';
import { Screen } from '../../../components/ui/Screen';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { useCore } from '../../pair';
import { captureQueryScope } from '../../../lib/query-client';
import { AppError, toAppError } from '@deseo/domain/result';
import { theme, ui } from '../../../theme';
import { listNotifications, notificationKeys } from '../queries';
import { markNotificationRead, resolveNotification } from '../commands';
import { notificationRoute } from '../navigation';
const states = { queued: 'Queued', submitted: 'Submitted to Expo', provider_accepted: 'Accepted by push provider', failed: 'Push failed', expired: 'Push expired', canceled: 'Push canceled' };
export function NotificationListScreen({ notificationId }: { notificationId?: string }) {
  const { account, pair, online } = useCore(); const router = useRouter(); const pairId = pair.status === 'active' ? pair.pairId : '';
  const [error, setError] = useState<string | null>(null); const [failedId, setFailedId] = useState<string | null>(null); const [opening, setOpening] = useState<string | null>(null);
  const pending = useRef(false); const opened = useRef<string | null>(null);
  const query = useInfiniteQuery({ queryKey: notificationKeys.list(account.id, pairId), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listNotifications(pageParam), getNextPageParam: page => page.nextCursor ?? undefined, enabled: !!pairId });
  const open = useCallback(async (id: string) => {
    if (pending.current || !pairId || !online) return;
    const scope = captureQueryScope(); pending.current = true; setOpening(id); setError(null); setFailedId(null);
    try {
      const result = await resolveNotification(id); scope.assertCurrent();
      if (!result.ok) throw new AppError(result.error);
      const route = notificationRoute(result.data, pairId);
      const marked = await markNotificationRead(id); scope.assertCurrent();
      if (!marked.ok) throw new AppError(marked.error);
      router.push(route);
    } catch (error) { try { scope.assertCurrent(); const parsed = toAppError(error);
      setFailedId(id); setError(parsed.code === 'FORBIDDEN' || parsed.code === 'VALIDATION' ? 'This content is unavailable. It may have been deleted or your pair changed.' : parsed.message);
    } catch { /* Access guard owns recovery. */ } }
    finally { pending.current = false; try { scope.assertCurrent(); setOpening(null); } catch { /* Access guard owns recovery. */ } }
  }, [online, pairId, router]);
  useEffect(() => { if (notificationId && notificationId !== opened.current && pairId && online) { opened.current = notificationId; void open(notificationId); } }, [notificationId, pairId, online, open]);
  const hasFailedRow = query.data?.pages.some(page => page.items.some(item => item.id === failedId));
  if (!pairId) return <Screen title="Notifications"><Status message="This content is unavailable." /></Screen>;
  return <Screen title="Notifications" refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    <Text style={theme.typography.secondary}>Your updates and reminders.</Text>
    {!online && <Status message="Reconnect to open a notification." />}
    {error && notificationId && failedId === notificationId && !hasFailedRow && <Status message={error} tone="error" actionLabel="Retry" onAction={() => { void open(notificationId); }} />}
    {query.isPending ? <Status tone="loading" message="Loading notifications…" /> : query.isError ? <Status message="We could not load notifications." actionLabel="Retry" onAction={() => { void query.refetch(); }} />
      : query.data.pages.flatMap(page => page.items).length ? <RowGroup>{query.data.pages.flatMap(page => page.items).map(item => <View key={item.id} style={styles.row}>
        <View style={ui.row}><Text style={[theme.typography.headline, styles.title]}>{item.kind === 'message' ? 'Message alert' : item.kind === 'event' ? 'Event reminder' : 'Task reminder'}</Text>{!item.readAt && <Text style={styles.unread}>Unread</Text>}</View>
        <Text style={theme.typography.secondary}>{DateTime.fromISO(item.createdAt).setZone(account.timezone).toLocaleString(DateTime.DATETIME_MED)}</Text>
        <Text style={theme.typography.secondary}>{states[item.state]}</Text>
        <Button label="Open" variant="text" compact loading={opening === item.id} disabled={!online || !!opening} onPress={() => { void open(item.id); }} />
        {failedId === item.id && error && <Status message={error} tone="error" />}
      </View>)}</RowGroup> : <Text style={theme.typography.body}>No notifications yet.</Text>}
    {query.hasNextPage && <Button label="Load more" loading={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }} />}
    <Button label="Notification preferences" variant="text" onPress={() => router.push('/settings/notifications')} />
  </Screen>;
}

const styles = StyleSheet.create({
  row: { paddingVertical: theme.space[4], gap: theme.space[2] },
  title: { flexShrink: 1 },
  unread: { ...theme.typography.badge, color: theme.colors.shared, backgroundColor: theme.colors.sharedSoft, borderRadius: theme.radius.badge, paddingHorizontal: theme.space[2], paddingVertical: theme.space[1], overflow: 'hidden' },
});
