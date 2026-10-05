import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
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
  const [error, setError] = useState<string | null>(null); const [opening, setOpening] = useState<string | null>(null);
  const pending = useRef(false); const opened = useRef<string | null>(null);
  const query = useInfiniteQuery({ queryKey: notificationKeys.list(account.id, pairId), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listNotifications(pageParam), getNextPageParam: page => page.nextCursor ?? undefined, enabled: !!pairId });
  const open = useCallback(async (id: string) => {
    if (pending.current || !pairId || !online) return;
    const scope = captureQueryScope(); pending.current = true; setOpening(id); setError(null);
    try {
      const result = await resolveNotification(id); scope.assertCurrent();
      if (!result.ok) throw new AppError(result.error);
      const route = notificationRoute(result.data, pairId);
      const marked = await markNotificationRead(id); scope.assertCurrent();
      if (!marked.ok) throw new AppError(marked.error);
      router.push(route);
    } catch (error) { try { scope.assertCurrent(); const parsed = toAppError(error);
      setError(parsed.code === 'FORBIDDEN' || parsed.code === 'VALIDATION' ? 'This content is unavailable. It may have been deleted or your pair changed.' : parsed.message);
    } catch { /* Access guard owns recovery. */ } }
    finally { pending.current = false; try { scope.assertCurrent(); setOpening(null); } catch { /* Access guard owns recovery. */ } }
  }, [online, pairId, router]);
  useEffect(() => { if (notificationId && notificationId !== opened.current && pairId && online) { opened.current = notificationId; void open(notificationId); } }, [notificationId, pairId, online, open]);
  if (!pairId) return <Screen title="Notifications"><Status message="This content is unavailable." /></Screen>;
  return <Screen title="Notifications" refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}>
    <Text style={theme.typography.secondary}>Provider acceptance does not confirm display on your device.</Text>
    {!online && <Status message="Reconnect to open a notification." />}
    {error && <Status message={error} tone="error" actionLabel={notificationId ? 'Retry' : undefined} onAction={notificationId ? () => { void open(notificationId); } : undefined} />}
    {query.isPending ? <Status message="Loading notifications…" /> : query.isError ? <Status message="We could not load notifications." actionLabel="Retry" onAction={() => { void query.refetch(); }} />
      : query.data.pages.flatMap(page => page.items).length ? query.data.pages.flatMap(page => page.items).map(item => <View key={item.id} style={ui.card}>
        <Text style={theme.typography.body}>{item.kind === 'message' ? 'Message alert' : item.kind === 'event' ? 'Event reminder' : 'Task reminder'}{item.readAt ? '' : ' · Unread'}</Text>
        <Text style={theme.typography.secondary}>{states[item.state]}</Text>
        <Button label="Open" loading={opening === item.id} disabled={!online || !!opening} onPress={() => { void open(item.id); }} />
      </View>) : <Text style={theme.typography.body}>No notifications yet.</Text>}
    {query.hasNextPage && <Button label="Load more" loading={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }} />}
    <Button label="Notification preferences" variant="text" onPress={() => router.push('/settings/notifications')} />
  </Screen>;
}
