import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { AppError, toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { captureQueryScope } from '../../../lib/query-client';
import { useNetworkStatus } from '../../../lib/network';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { Button } from '../../../components/ui/Button';
import { listNotifications, notificationKeys } from '../queries';
import { resolveNotification, markNotificationRead } from '../commands';
const states = { queued: 'Queued', submitted: 'Submitted to Expo', provider_accepted: 'Accepted by push provider', failed: 'Push failed', expired: 'Push expired', canceled: 'Push canceled' };
export function NotificationsPage() {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const online = useNetworkStatus(); const navigate = useNavigate();
  const [error, setError] = useState(''); const [opening, setOpening] = useState('');
  const mounted = useRef(false); const pending = useRef(false);
  const scopeCleanup = useRef<() => void>(undefined);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; scopeCleanup.current?.(); }; }, []);
  function beginScope() {
    scopeCleanup.current?.();
    const scope = captureQueryScope();
    const unlock = () => { if (mounted.current) { pending.current = false; setOpening(''); } };
    scope.signal.addEventListener('abort', unlock, { once: true });
    scopeCleanup.current = () => scope.signal.removeEventListener('abort', unlock);
    return scope;
  }
  const query = useInfiniteQuery({ queryKey: notificationKeys.list(account!.id, pairId), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listNotifications(pageParam), getNextPageParam: page => page.nextCursor ?? undefined, enabled: Boolean(pairId) });
  async function open(id: string) {
    if (pending.current || !online || !pairId) return;
    const scope = beginScope(); pending.current = true; setOpening(id); setError('');
    try {
      const result = await resolveNotification(id); scope.assertCurrent();
      if (!result.ok) throw new AppError(result.error);
      if (result.data.pairId !== pairId) throw new AppError({ code: 'FORBIDDEN' });
      const marked = await markNotificationRead(id); scope.assertCurrent();
      if (!marked.ok) throw new AppError(marked.error);
      await query.refetch(); scope.assertCurrent();
      if (mounted.current) navigate(result.data.kind === 'messages' ? '/messages' : '/' + (result.data.kind === 'event' ? 'events' : 'tasks') + '/' + result.data.id);
    } catch (cause) {
      try { scope.assertCurrent(); if (mounted.current) { const failure = toAppError(cause);
        setError(['FORBIDDEN', 'VALIDATION'].includes(failure.code) ? 'This content is unavailable. Your pair or the source changed.' : failure.message); }
      } catch { /* Session recovery owns access. */ }
    } finally { if (mounted.current && !scope.signal.aborted) { pending.current = false; setOpening(''); } }
  }
  return <><PageHeader title="Notifications" description="Provider acceptance does not confirm display on your device." action={<Link to="/settings/notifications">Notification preferences</Link>} />
    {error && <Status error>{error}</Status>}
    {!pairId ? <section className="card"><p>This content is unavailable without an active pair.</p></section> : query.isPending ? <Status>Loading notifications…</Status> : query.isError ? <><Status error>We could not load notifications.</Status><Button onClick={() => void query.refetch()}>Retry</Button></> :
    <div className="notification-list">{query.data.pages.flatMap(page => page.items).length ? query.data.pages.flatMap(page => page.items).map(item => <section className="card" key={item.id}>
      <h2>{item.kind === 'message' ? 'Message alert' : item.kind === 'event' ? 'Event reminder' : 'Task reminder'}</h2><p>{states[item.state]}{item.readAt ? '' : ' · Unread'}</p>
      <Button disabled={!online || Boolean(opening)} onClick={() => void open(item.id)}>{opening === item.id ? 'Opening…' : 'Open'}</Button>
    </section>) : <section className="card"><p>No notifications yet.</p></section>}
    {query.hasNextPage && <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more</Button>}</div>}</>;
}
