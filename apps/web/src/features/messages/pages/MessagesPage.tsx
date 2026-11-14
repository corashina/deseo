import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { compareMessageCursors, messageBodySchema, type Message, type MessageCursor } from '@deseo/domain/messages';
import { toAppError } from '@deseo/domain/result';
import { useSession } from '../../../app/SessionProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { Dialog } from '../../../components/ui/Dialog';
import { useUnsavedChanges } from '../../../lib/unsaved-changes';
import { listMessages, messageKeys } from '../queries';
import { deleteMessage, pinMessage, sendMessage, setReadCursor, unpinMessage } from '../commands';
import { listPinnedNotes } from '../notes';
import { MessageRow } from '../components/MessageRow';
import { NoteCard } from '../components/NoteCard';
import { Composer } from '../components/Composer';
import '../../../styles/messages.css';

type Unsent = { clientId: string; body: string; failed: boolean };
export function MessagesPage() {
  const { account, pair } = useSession();
  const pairId = pair?.status === 'active' ? pair.pairId : '';
  const accountId = account!.id;
  const [search] = useSearchParams();
  const notesView = search.get('view') === 'notes';
  const conversation = useInfiniteQuery({ queryKey: messageKeys.conversation(accountId, pairId),
    queryFn: ({ pageParam }) => listMessages(pairId, pageParam), initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined, enabled: !notesView });
  const notes = useQuery({ queryKey: messageKeys.notes(accountId, pairId), queryFn: () => listPinnedNotes(pairId), enabled: notesView });
  const { messagesById, messages } = useMemo(() => {
    const messagesById = new Map<string, Message>();
    for (const page of conversation.data?.pages ?? []) for (const message of page.items) {
      if ((messagesById.get(message.id)?.version ?? 0) < message.version) messagesById.set(message.id, message);
    }
    return { messagesById, messages: [...messagesById.values()].sort(compareMessageCursors) };
  }, [conversation.data?.pages]);
  const list = useRef<HTMLDivElement>(null);
  const mountedList = useRef<HTMLDivElement | null>(null);
  const scrollPosition = useRef<number | null>(null);
  const [atLatest, setAtLatest] = useState(true);
  const lastRead = useRef<MessageCursor | null>(null);
  const [readError, setReadError] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const [body, setBody] = useState('');
  const [unsent, setUnsent] = useState<readonly Unsent[]>([]);
  const [deleting, setDeleting] = useState<Message | null>(null);
  useUnsavedChanges(Boolean(body) || unsent.length > 0);
  const action = useMutation({
    mutationFn: ({ kind, id }: { kind: 'pin' | 'unpin' | 'delete'; id: string }) => (kind === 'delete' ? deleteMessage : kind === 'pin' ? pinMessage : unpinMessage)(id),
    onSuccess: () => setDeleting(null),
  });
  const busy = action.isPending;
  const error = action.isError ? toAppError(action.error).message : '';
  // A send keeps its client ID. A retry then cannot store the message twice.
  async function deliver(item: Unsent) {
    setUnsent(rows => rows.map(row => row.clientId === item.clientId ? { ...row, failed: false } : row));
    try {
      await sendMessage({ pairId, clientId: item.clientId, body: item.body });
      setUnsent(rows => rows.filter(row => row.clientId !== item.clientId));
    } catch {
      setUnsent(rows => rows.map(row => row.clientId === item.clientId ? { ...row, failed: true } : row));
    }
  }
  function send() {
    if (!messageBodySchema.safeParse(body).success) return;
    const item = { clientId: crypto.randomUUID(), body, failed: false };
    setUnsent(rows => [...rows, item]);
    setBody('');
    void deliver(item);
  }

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
    if (notesView || !conversation.data || !list.current) return;
    let active = true;
    const observer = new IntersectionObserver(entries => {
      if (!active || document.visibilityState === 'hidden') return;
      const visible = entries.filter(entry => entry.isIntersecting).map(entry =>
        messagesById.get((entry.target as HTMLElement).dataset.messageId!)).filter((message): message is Message => Boolean(message));
      const newest = visible.sort(compareMessageCursors).at(-1);
      if (!newest || lastRead.current && compareMessageCursors(newest, lastRead.current) <= 0) return;
      lastRead.current = newest;
      setReadCursor(accountId, pairId, { id: newest.id, createdAt: newest.createdAt }).then(
        () => { if (active) setReadError(false); },
        () => { if (active) { lastRead.current = null; setReadError(true); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -80px 0px' });
    const observe = () => {
      if (!active || document.visibilityState === 'hidden') return;
      observer.disconnect();
      list.current?.querySelectorAll('[data-message-id]').forEach(row => observer.observe(row));
    };
    observe();
    document.addEventListener('visibilitychange', observe);
    return () => { active = false; observer.disconnect(); lastRead.current = null; document.removeEventListener('visibilitychange', observe); };
    // Use each authenticated data result to observe its rendered message rows.
  }, [accountId, conversation.data, messagesById, notesView, pairId, readAttempt]);

  const pin = (message: Message) => action.mutate({ kind: message.pinnedAt ? 'unpin' : 'pin', id: message.id });
  if (pair?.status !== 'active') return null;
  const member = (message: Message) => pair.members.find(person => person.userId === message.authorId)!;
  const query = notesView ? notes : conversation;
  return <section className={'messages-page' + (notesView ? '' : ' conversation-page')}>
    <PageHeader title="Messages" description={pair.members.map(person => person.displayName).join(' + ')} />
    <div className="message-views" aria-label="Message views"><Link to="/messages" aria-current={!notesView ? 'page' : undefined}>Conversation</Link><Link to="/messages?view=notes" aria-current={notesView ? 'page' : undefined}>Pinned notes</Link></div>
    {error && !deleting && <><Status error>{error}</Status><Button onClick={() => action.mutate(action.variables!)}>Retry change</Button></>}
    {query.isPending ? <Status>Loading messages…</Status> : query.isError ? <><Status error>We could not load messages.</Status><Button onClick={() => void query.refetch()}>Retry</Button></> : notesView ?
      <div className="notes-grid">{notes.data?.length ? notes.data.map(message => <NoteCard key={message.id} message={message} name={member(message).displayName} own={message.authorId === accountId} disabled={busy} timezone={account!.timezone} locale={account!.locale} onUnpin={pin} />) : <section className="card"><h2>No pinned notes</h2><p>Pin one of your messages to keep it on Today.</p><Link to="/messages">Open conversation</Link></section>}</div> : <>
        {conversation.hasNextPage && <Button variant="secondary" disabled={conversation.isFetchingNextPage} onClick={() => void conversation.fetchNextPage()}>{conversation.isFetchingNextPage ? 'Loading older messages…' : 'Load older messages'}</Button>}
        {!atLatest && <Button variant="secondary" onClick={() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }}>Latest messages</Button>}
        {readError && <><Status error>We could not update your unread count.</Status><Button onClick={() => { lastRead.current = null; setReadAttempt(value => value + 1); }}>Retry unread count</Button></>}
        <div className="conversation" ref={list} onScroll={event => { const element = event.currentTarget; scrollPosition.current = element.scrollTop; setAtLatest(element.scrollHeight - element.scrollTop - element.clientHeight <= 24); }} aria-label="Conversation messages">{messages.length ? messages.map(message => <MessageRow key={message.id} message={message} name={member(message).displayName} slot={member(message).slot} own={message.authorId === accountId} disabled={busy} timezone={account!.timezone} locale={account!.locale} onPin={pin} onDelete={setDeleting} />) : <section className="card"><h2>Start your conversation</h2><p>Send a message to your partner.</p></section>}</div>
      </>}
    {!notesView && <>
      {unsent.map(item => <article className="card pending-send" key={item.clientId} data-testid="pending-send"><p className="preserve-lines">{item.body}</p>{item.failed ? <><Status error>Not sent</Status><Button variant="secondary" onClick={() => void deliver(item)}>Retry</Button></> : <Status>Sending…</Status>}</article>)}
      <Composer body={body} onChange={setBody} onSend={send} disabled={false} />
    </>}
    <Dialog busy={busy} title="Delete message?" open={Boolean(deleting)} onClose={() => { if (!busy) setDeleting(null); }}><p>Delete your message from this conversation and pinned notes.</p>{error && deleting && <Status error>{error}</Status>}<Button variant="danger" disabled={busy} onClick={() => deleting && action.mutate({ kind: 'delete', id: deleting.id })}>Confirm deletion</Button><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button></Dialog>
  </section>;
}
