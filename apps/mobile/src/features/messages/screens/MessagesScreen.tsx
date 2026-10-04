import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
  type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useIsFocused } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { randomUUID } from 'expo-crypto';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { usePairGate, type PairContext } from '../../pair';
import { useAuth, type Account } from '../../auth';
import { Button } from '../../../components/ui/Button';
import { Status } from '../../../components/ui/Status';
import { theme } from '../../../theme';
import { AppError } from '../../../lib/result';
import { captureQueryScope } from '../../../lib/query-client';
import { deleteMessage, setReadCursor } from '../commands';
import { listMessages, messageKeys } from '../queries';
import { listPinnedNotes, pinMessage, unpinMessage } from '../notes';
import { compareMessageCursors, flattenMessagePages } from '../model';
import { subscribeMessages } from '../realtime';
import { useMessageDraft } from '../useMessageDraft';
import { Composer } from '../components/Composer';
import { MessageRow, PendingMessageRow } from '../components/MessageRow';
import { NoteCard } from '../components/NoteCard';
import type { Message, MessageCursor, PendingMessage } from '../types';

type Row = { kind: 'message'; message: Message } | { kind: 'pending'; message: PendingMessage };
type MessageAction = { kind: 'delete' | 'pin' | 'unpin'; id: string; commandId: string };
const visibility = { viewAreaCoveragePercentThreshold: 50, minimumViewTime: 500 };
const preservePosition = { minIndexForVisible: 0 };
const rowKey = (row: Row) => row.kind === 'message' ? row.message.id : `pending:${row.message.clientId}`;

export function MessagesScreen() {
  const { state } = useAuth();
  const gate = usePairGate();
  if (state.status === 'signedOut' || state.status === 'error' || (state.status === 'authenticated' && !state.account)) {
    return <Redirect href="/" />;
  }
  if (state.status === 'loading') return <SafeAreaView style={styles.fill}><Status message="Checking your account…" /></SafeAreaView>;
  if (!gate.account || !gate.pair || gate.checking || gate.error) return <SafeAreaView style={styles.fill}>
    <Status message={gate.error ? 'We could not check your pair. Try again.' : 'Checking your pair…'}
      tone={gate.error ? 'error' : 'info'} actionLabel="Check pair" onAction={() => { void gate.refresh(); }} />
  </SafeAreaView>;
  if (gate.pair.status !== 'active') return <Redirect href="/" />;
  return <Conversation key={`${gate.account.id}:${gate.pair.pairId}`} account={gate.account} pair={gate.pair} online={gate.online} />;
}

function Conversation({ account, pair, online }: {
  account: Account; pair: Extract<PairContext, { status: 'active' }>; online: boolean;
}) {
  const focused = useIsFocused();
  const headerHeight = useHeaderHeight();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [scope] = useState(captureQueryScope);
  const live = focused && active && online;
  const draft = useMessageDraft(account.id, pair.pairId, online);
  const conversation = useInfiniteQuery({ queryKey: messageKeys.conversation(account.id, pair.pairId),
    queryFn: ({ pageParam }) => listMessages(pair.pairId, pageParam), initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined, enabled: live,
    refetchOnWindowFocus: false, refetchOnReconnect: false });
  const notes = useQuery({ queryKey: messageKeys.notes(account.id, pair.pairId), queryFn: () => listPinnedNotes(pair.pairId),
    enabled: live, refetchOnWindowFocus: false, refetchOnReconnect: false });
  const fetchedMessages = useMemo(() => flattenMessagePages(conversation.data?.pages ?? []), [conversation.data]);
  const displayedMessages = useRef(fetchedMessages);
  const loadedBoundary = displayedMessages.current.at(-1);
  const fetchedBoundary = fetchedMessages.at(-1);
  const needsOlder = !!(conversation.hasNextPage && loadedBoundary && fetchedBoundary
    && compareMessageCursors(fetchedBoundary, loadedBoundary) > 0);
  // Keep the displayed window until the refreshed pages cover its oldest boundary.
  // This also covers refetches initiated by commands or another feature's invalidation.
  if (!needsOlder) displayedMessages.current = fetchedMessages;
  const messages = displayedMessages.current;
  const rows = useMemo<Row[]>(() => [
    ...draft.pending.filter(pending => !messages.some(message => message.authorId === account.id && message.clientId === pending.clientId))
      .slice().reverse().map(message => ({ kind: 'pending' as const, message })),
    ...messages.map(message => ({ kind: 'message' as const, message })),
  ], [messages, draft.pending, account.id]);
  const ownMember = pair.members.find(member => member.userId === account.id)!;
  const list = useRef<FlatList<Row>>(null);
  const composer = useRef<TextInput>(null);
  const atLatest = useRef(true);
  const newest = useRef<string | null>(null);
  const [newMessages, setNewMessages] = useState(false);
  const [visible, setVisible] = useState<MessageCursor | null>(null);
  const lastReadAttempt = useRef<MessageCursor | null>(null);
  const [readError, setReadError] = useState(false);
  const [readRetry, setReadRetry] = useState(0);
  const [action, setAction] = useState<MessageAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const actionBusy = useRef(false);
  const paging = useRef(false);
  const refreshing = useRef<Promise<void> | null>(null);
  const refreshAgain = useRef(false);
  useEffect(() => {
    if (!needsOlder || !loadedBoundary || !live || conversation.isFetching || conversation.isError || paging.current) return;
    paging.current = true;
    void (async () => {
      for (;;) {
        const result = await conversation.fetchNextPage({ cancelRefetch: false });
        scope.assertCurrent();
        const tail = result.data?.pages.at(-1)?.items.at(-1);
        if (result.isError || !result.hasNextPage || !tail || compareMessageCursors(tail, loadedBoundary) <= 0) return;
      }
    })().catch(() => undefined).finally(() => { paging.current = false; });
  }, [needsOlder, loadedBoundary, live, conversation.isFetching, conversation.isError, conversation.fetchNextPage, scope]);
  const refresh = useCallback((): Promise<void> => {
    if (!live) return Promise.resolve();
    refreshAgain.current = true;
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
      do {
        refreshAgain.current = false;
        const waitingForPage = paging.current;
        let result = await conversation.refetch({ cancelRefetch: false });
        scope.assertCurrent();
        // refetch(false) joins an older-page request. Fetch the head after that request finishes.
        if (waitingForPage) result = await conversation.refetch({ cancelRefetch: false });
        scope.assertCurrent();
        if (result.isError) break;
        await draft.reconcile();
        await notes.refetch();
        scope.assertCurrent();
        lastReadAttempt.current = null; setReadRetry(value => value + 1);
      } while (refreshAgain.current);
    })().finally(() => { refreshing.current = null; });
    return refreshing.current;
  }, [live, conversation.refetch, draft.reconcile, notes.refetch, scope]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (!live) return;
    let current = true;
    let stop: (() => void) | undefined;
    void subscribeMessages(account.id, pair.pairId, () => { if (current) void refresh().catch(() => undefined); })
      .then(remove => { if (current) stop = remove; else remove(); }).catch(() => undefined);
    // A failed realtime connection must not prevent a durable refresh.
    void refresh().catch(() => undefined);
    return () => { current = false; stop?.(); };
  }, [account.id, pair.pairId, live, refresh]);
  useEffect(() => {
    if (draft.ready && live && conversation.isSuccess && !conversation.isFetching) void draft.reconcile();
  }, [draft.ready, draft.reconcile, live, conversation.isSuccess, conversation.isFetching, conversation.dataUpdatedAt]);
  const newestId = messages[0]?.id ?? null;
  useEffect(() => {
    if (newest.current && newestId && newest.current !== newestId) {
      if (atLatest.current) list.current?.scrollToOffset({ offset: 0, animated: false });
      else setNewMessages(true);
    }
    newest.current = newestId;
  }, [newestId]);
  const onVisible = useRef(({ viewableItems }: { viewableItems: ViewToken<Row>[] }) => {
    const seen = viewableItems.filter(item => item.isViewable && item.item.kind === 'message')
      .map(item => item.item.message as Message).sort((a, b) => compareMessageCursors(b, a))[0];
    setVisible(seen ? { createdAt: seen.createdAt, id: seen.id } : null);
  }).current;
  useEffect(() => {
    if (!live || !visible || conversation.isFetching || !conversation.isSuccess) return;
    if (lastReadAttempt.current && compareMessageCursors(visible, lastReadAttempt.current) <= 0) return;
    lastReadAttempt.current = visible;
    let current = true;
    void setReadCursor(pair.pairId, visible).then(result => {
      if (current) setReadError(!result.ok);
    });
    return () => { current = false; };
  }, [live, visible, pair.pairId, conversation.isFetching, conversation.isSuccess, readRetry]);
  const runAction = useCallback(async (request: MessageAction) => {
    if (!online || actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setAction(request); setActionError(null);
    try {
      const command = request.kind === 'delete' ? deleteMessage : request.kind === 'pin' ? pinMessage : unpinMessage;
      const result = await command(request.id, request.commandId);
      scope.assertCurrent();
      if (result.ok) setAction(null);
      else setActionError(new AppError(result.error).message);
    } catch { /* Access reset removes this screen. */ }
    finally { actionBusy.current = false; setBusy(false); }
  }, [online, scope]);
  const choosePin = useCallback((message: Message) => {
    void runAction({ kind: message.pinnedAt ? 'unpin' : 'pin', id: message.id, commandId: randomUUID() });
  }, [runAction]);
  const chooseDelete = useCallback((message: Message) => {
    Alert.alert('Delete this message?', 'This removes the message and its note for both people.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete message', style: 'destructive', onPress: () => {
        void runAction({ kind: 'delete', id: message.id, commandId: randomUUID() });
      } },
    ]);
  }, [runAction]);
  const discard = useCallback((id: string) => {
    Alert.alert('Discard this pending message?', 'If an earlier send reached the server, the sent message will remain.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { void draft.discard(id); } },
    ]);
  }, [draft.discard]);
  const renderRow = useCallback(({ item }: { item: Row }) => item.kind === 'pending'
    ? <PendingMessageRow message={item.message} member={ownMember} online={online}
      onRetry={id => { void draft.retry(id); }} onDiscard={discard} />
    : <MessageRow message={item.message} member={pair.members.find(member => member.userId === item.message.authorId)!}
      own={item.message.authorId === account.id} timezone={account.timezone} locale={account.locale}
      disabled={!online || !!action} onPin={choosePin} onDelete={chooseDelete} />,
  [ownMember, online, draft.retry, discard, pair.members, account.id, account.timezone, account.locale, action, choosePin, chooseDelete]);
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.fill}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight}>
      <View style={styles.heading}><Text accessibilityRole="header" style={theme.typography.title}>Messages</Text></View>
      {!keyboardOpen && !!notes.data?.length && <ScrollView style={styles.notes} contentContainerStyle={styles.notesContent}>
        {notes.data.map(message => <NoteCard key={message.id} message={message}
          authorName={pair.members.find(member => member.userId === message.authorId)!.displayName}
          onReply={() => composer.current?.focus()} onOpen={() => Alert.alert('Note', message.body, [
            ...(message.authorId === account.id && !action && online ? [{ text: 'Unpin', onPress: () => choosePin(message) }] : []),
            { text: 'Close', style: 'cancel' },
          ])} />)}
      </ScrollView>}
      {!online && <Text accessibilityLiveRegion="polite" style={styles.notice}>You are offline. You can write a draft.</Text>}
      {draft.error && <Status message={draft.error} tone="error" />}
      {draft.pending.length >= 100 && <Text style={styles.notice}>Retry or discard a pending message before sending another.</Text>}
      {(conversation.isError || notes.isError) && <Status message="We could not load Messages. Your draft is still here." tone="error"
        actionLabel="Refresh" onAction={() => { void refresh().catch(() => undefined); }} />}
      {readError && <Status message="We could not update unread messages." actionLabel="Refresh"
        onAction={() => { void refresh().catch(() => undefined); }} />}
      {actionError && action && <View><Status message={actionError} tone="error" actionLabel="Retry action"
        onAction={() => { void runAction(action); }} />
        <Button label="Dismiss" variant="text" disabled={busy} onPress={() => { setAction(null); setActionError(null); }} />
      </View>}
      {busy && <Text accessibilityLiveRegion="polite" style={styles.notice}>Saving…</Text>}
      {newMessages && <Button label="New messages" variant="secondary" onPress={() => {
        list.current?.scrollToOffset({ offset: 0, animated: true }); atLatest.current = true; setNewMessages(false);
      }} />}
      <FlatList ref={list} testID="conversation" data={rows} renderItem={renderRow} keyExtractor={rowKey} inverted
        style={styles.fill} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        maintainVisibleContentPosition={preservePosition} onViewableItemsChanged={onVisible} viewabilityConfig={visibility}
        onScroll={event => { atLatest.current = event.nativeEvent.contentOffset.y < 40;
          if (atLatest.current) setNewMessages(false); }} scrollEventThrottle={100}
        ListEmptyComponent={<Text style={styles.notice}>{conversation.isPending && online ? 'Loading messages…' : 'Send your first message.'}</Text>}
        ListFooterComponent={conversation.hasNextPage ? <Button label="Load older messages" variant="text"
          loading={conversation.isFetchingNextPage} disabled={!online || conversation.isFetching}
          onPress={() => {
            if (conversation.isFetching || paging.current) return;
            paging.current = true;
            void conversation.fetchNextPage({ cancelRefetch: false }).finally(() => { paging.current = false; });
          }} /> : null} />
      <Composer ref={composer} body={draft.body} ready={draft.ready} online={online} full={draft.pending.length >= 100}
        onChange={draft.changeBody} onSend={() => { void draft.send(); }} />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.colors.canvas }, heading: { paddingHorizontal: 16, paddingVertical: 8 },
  notice: { ...theme.typography.secondary, paddingHorizontal: 16, paddingVertical: 8 },
  notes: { maxHeight: 180, flexGrow: 0 }, notesContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
});
