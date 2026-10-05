import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { Message, MessageCursor } from '@deseo/domain/messages';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { Dialog } from '../../../components/ui/Dialog';
import { captureQueryScope } from '../../../lib/query-client';
import { useNetworkStatus } from '../../../lib/network';
import { compareMessageCursors, listMessages, messageKeys } from '../queries';
import { deleteMessage, setReadCursor } from '../commands';
import { listPinnedNotes, pinMessage, unpinMessage } from '../notes';
import { usePendingSends } from '../pending-sends';
import { MessageRow } from '../components/MessageRow';
import { NoteCard } from '../components/NoteCard';
import { Composer } from '../components/Composer';
import '../../../styles/planning.css';
import '../../../styles/messages.css';

type Attempt = { kind: 'pin' | 'unpin' | 'delete'; message: Message; commandId: string };
export function MessagesPage() {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const accountId = account!.id;
  const online = useNetworkStatus();
  const [search] = useSearchParams();
  const notesView = search.get('view') === 'notes';
  const draft = usePendingSends(accountId, pairId);
  const conversation = useInfiniteQuery({ queryKey: messageKeys.conversation(accountId, pairId),
    queryFn: ({ pageParam }) => listMessages(pairId, pageParam), initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined, enabled: !notesView });
  const notes = useQuery({ queryKey: messageKeys.notes(accountId, pairId), queryFn: () => listPinnedNotes(pairId), enabled: notesView });
  const messagesById = new Map<string, Message>();
  for (const page of conversation.data?.pages ?? []) for (const message of page.items) {
    if ((messagesById.get(message.id)?.version ?? 0) < message.version) messagesById.set(message.id, message);
  }
  const messages = [...messagesById.values()].sort(compareMessageCursors);
  const list = useRef<HTMLDivElement>(null);
  const mountedList = useRef<HTMLDivElement | null>(null);
  const scrollPosition = useRef<number | null>(null);
  const [atLatest, setAtLatest] = useState(true);
  const lastRead = useRef<MessageCursor | null>(null);
  const [readError, setReadError] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    const element = list.current;
    if (!element) return;
    if (element !== mountedList.current) {
      // Open at the latest messages once. Keep the reader's position during updates.
      element.scrollTop = scrollPosition.current ?? element.scrollHeight;
      mountedList.current = element;
    }
    setAtLatest(element.scrollHeight - element.scrollTop - element.clientHeight <= 24);
  }, [conversation.data, notesView]);

  useEffect(() => {
    if (notesView || !online || !conversation.data || !list.current) return;
    const scope = captureQueryScope();
    if (scope.signal.aborted) return;
    let active = true;
    const observer = new IntersectionObserver(entries => {
      if (!active || document.visibilityState === 'hidden') return;
      const visible = entries.filter(entry => entry.isIntersecting).map(entry =>
        messagesById.get((entry.target as HTMLElement).dataset.messageId!)).filter((message): message is Message => Boolean(message));
      const newest = visible.sort(compareMessageCursors).at(-1);
      if (!newest || lastRead.current && compareMessageCursors(newest, lastRead.current) <= 0) return;
      lastRead.current = newest;
      void setReadCursor(pairId, { id: newest.id, createdAt: newest.createdAt }).then(result => {
        try { scope.assertCurrent(); } catch { return; }
        if (!active || !alive.current) return;
        if (!result.ok) { lastRead.current = null; setReadError(true); }
        else setReadError(false);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -80px 0px' });
    const observe = () => {
      if (!active || document.visibilityState === 'hidden') return;
      observer.disconnect();
      list.current?.querySelectorAll('[data-message-id]').forEach(row => observer.observe(row));
    };
    observe();
    document.addEventListener('visibilitychange', observe);
    const close = () => { active = false; observer.disconnect(); lastRead.current = null; };
    scope.signal.addEventListener('abort', close, { once: true });
    return () => { scope.signal.removeEventListener('abort', close); document.removeEventListener('visibilitychange', observe); close(); };
    // Use each authenticated data result to observe its rendered message rows.
  }, [conversation.data, notesView, online, pairId, readAttempt]);

  async function execute(next: Attempt) {
    if (!online || busy) return;
    const scope = captureQueryScope();
    setAttempt(next); setBusy(true); setError('');
    const result = await (next.kind === 'delete' ? deleteMessage : next.kind === 'pin' ? pinMessage : unpinMessage)(next.message.id, next.commandId);
    try { scope.assertCurrent(); } catch { if (alive.current) setBusy(false); return; }
    if (!alive.current) return;
    setBusy(false);
    if (result.ok) { setAttempt(null); setDeleting(null); }
    else setError('We could not save this change. Retry.');
  }
  const pin = (message: Message) => void execute({ kind: message.pinnedAt ? 'unpin' : 'pin', message, commandId: crypto.randomUUID() });
  if (pair?.status !== 'active') return null;
  const member = (message: Message) => pair.members.find(person => person.userId === message.authorId)!;
  const query = notesView ? notes : conversation;
  return <section className={'messages-page' + (notesView ? '' : ' conversation-page')}>
    <PageHeader title="Messages" description={pair.members.map(person => person.displayName).join(' + ')} />
    <div className="message-views" aria-label="Message views"><Link to="/messages" aria-current={!notesView ? 'page' : undefined}>Conversation</Link><Link to="/messages?view=notes" aria-current={notesView ? 'page' : undefined}>Pinned notes</Link></div>
    {error && <><Status error>{error}</Status><Button disabled={!online || busy} onClick={() => attempt && void execute(attempt)}>Retry change</Button></>}
    {query.isPending ? <Status>Loading messages…</Status> : query.isError ? <><Status error>We could not load messages.</Status><Button disabled={!online} onClick={() => void query.refetch()}>Retry</Button></> : notesView ?
      <div className="notes-grid">{notes.data?.length ? notes.data.map(message => <NoteCard key={message.id} message={message} name={member(message).displayName} own={message.authorId === accountId} disabled={!online || busy} onUnpin={pin} />) : <section className="card"><h2>No pinned notes</h2><p>Pin one of your messages to keep it on Today.</p><Link to="/messages">Open conversation</Link></section>}</div> : <>
        {conversation.hasNextPage && <Button variant="secondary" disabled={!online || conversation.isFetchingNextPage} onClick={() => void conversation.fetchNextPage()}>{conversation.isFetchingNextPage ? 'Loading older messages…' : 'Load older messages'}</Button>}
        {!atLatest && <Button variant="secondary" onClick={() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }}>Latest messages</Button>}
        {readError && <><Status error>We could not update your unread count.</Status><Button disabled={!online} onClick={() => { lastRead.current = null; setReadAttempt(value => value + 1); }}>Retry unread count</Button></>}
        <div className="conversation" ref={list} onScroll={event => { const element = event.currentTarget; scrollPosition.current = element.scrollTop; setAtLatest(element.scrollHeight - element.scrollTop - element.clientHeight <= 24); }} aria-label="Conversation messages">{messages.length ? messages.map(message => <MessageRow key={message.id} message={message} name={member(message).displayName} slot={member(message).slot} own={message.authorId === accountId} disabled={!online || busy} onPin={pin} onDelete={setDeleting} />) : <section className="card"><h2>Start your conversation</h2><p>Send a message to your partner.</p></section>}</div>
      </>}
    {!notesView && <>
      {draft.error && <Status error>{draft.error}</Status>}
      {draft.pending.map(item => <article className="card pending-send" key={item.clientId} data-testid="pending-send"><p className="preserve-lines">{item.body}</p><Status>{draft.busy.includes(item.clientId) ? 'Sending…' : item.failed ? 'Delivery not confirmed' : 'Check delivery before retrying'}</Status><Button variant="secondary" disabled={!online || draft.busy.includes(item.clientId)} onClick={() => draft.retry(item.clientId)}>Retry message</Button></article>)}
      <Composer body={draft.body} onChange={draft.changeBody} onSend={draft.send} disabled={!online || draft.pending.length >= 100} />
    </>}
    <Dialog title="Delete message?" open={Boolean(deleting)} onClose={() => { if (!busy) setDeleting(null); }}><p>Delete your message from this conversation and pinned notes.</p>{error && <Status error>{error}</Status>}<Button variant="danger" disabled={!online || busy} onClick={() => deleting && void execute(attempt?.kind === 'delete' && attempt.message.id === deleting.id ? attempt : { kind: 'delete', message: deleting, commandId: crypto.randomUUID() })}>Confirm deletion</Button><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button></Dialog>
  </section>;
}
