import { useEffect, useRef, useState } from 'react';
import { DateTime } from 'luxon';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { AppError, toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { useCommandScope } from '../../../lib/use-command-scope';
import { useNetworkStatus } from '../../../lib/network';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Status } from '../../../components/ui/Status';
import { formatDate } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { listNotifications, notificationKeys } from '../queries';
import { resolveNotification, markNotificationRead } from '../commands';
import '../../../styles/notifications.css';
const states = { queued: 'Queued', submitted: 'Submitted to Expo', provider_accepted: 'Accepted by push provider', failed: 'Push failed', expired: 'Push expired', canceled: 'Push canceled' };
export function NotificationsPage() {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const online = useNetworkStatus(); const navigate = useNavigate();
  const [error, setError] = useState(''); const [failedId, setFailedId] = useState(''); const [opening, setOpening] = useState('');
  const mounted = useRef(false); const pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const beginScope = useCommandScope(() => { pending.current = false; setOpening(''); });
  const query = useInfiniteQuery({ queryKey: notificationKeys.list(account!.id, pairId), initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => listNotifications(pageParam), getNextPageParam: page => page.nextCursor ?? undefined, enabled: Boolean(pairId) });
  async function open(id: string) {
    if (pending.current || !online || !pairId) return;
    const scope = beginScope(); pending.current = true; setOpening(id); setError(''); setFailedId('');
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
        setFailedId(id); setError(['FORBIDDEN', 'VALIDATION'].includes(failure.code) ? 'This content is unavailable. Your pair or the source changed.' : failure.message); }
      } catch { /* Session recovery owns access. */ }
    } finally { if (mounted.current && !scope.signal.aborted) { pending.current = false; setOpening(''); } }
  }
  return <><PageHeader title="Notifications" description="Your updates and reminders." action={<Link to="/settings/notifications">Notification preferences</Link>} />
    {!pairId ? <section className="card"><p>This content is unavailable without an active pair.</p></section> : query.isPending ? <Status>Loading notifications…</Status> : query.isError ? <><Status error>We could not load notifications.</Status><Button onClick={() => void query.refetch()}>Retry</Button></> :
    <div className="card notification-list">{query.data.pages.flatMap(page => page.items).length ? query.data.pages.flatMap(page => page.items).map(item => <section className="notification-row" key={item.id}>
      <div className="notification-main">
        <div className="notification-content">
          <div className="notification-heading"><h2>{item.kind === 'message' ? 'Message alert' : item.kind === 'event' ? 'Event reminder' : 'Task reminder'}</h2>{!item.readAt && <span className="notification-unread">Unread</span>}</div>
          <time className="muted" dateTime={item.createdAt}>{formatDate(DateTime.fromISO(item.createdAt).setZone(account!.timezone), 'dateTime', account!.locale)}</time>
          <p className="muted">{states[item.state]}</p>
        </div>
        <Button variant="secondary" disabled={!online || Boolean(opening)} onClick={() => void open(item.id)}>{opening === item.id ? 'Opening…' : 'Open'}</Button>
      </div>
      {failedId === item.id && error && <Status error>{error}</Status>}
    </section>) : <p>No notifications yet.</p>}
    {query.hasNextPage && <Button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more</Button>}</div>}</>;
}
