// Importance: 100. Direct routes must not render private content until the pair check succeeds.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { MessagesScreen } from './MessagesScreen';
import { usePairGate } from '../../pair';
import { useAuth } from '../../auth';
import { listMessages } from '../queries';
import { listPinnedNotes } from '../notes';
import { setReadCursor } from '../commands';
import { subscribeMessages } from '../realtime';

jest.mock('../../pair', () => ({ usePairGate: jest.fn() }));
jest.mock('../../auth', () => ({ useAuth: jest.fn() }));
jest.mock('../queries', () => ({ listMessages: jest.fn(), messageKeys: {
  all: (a: string, p: string) => ['messages', a, p],
  conversation: (a: string, p: string) => ['messages', a, p, 'conversation'],
  notes: (a: string, p: string) => ['messages', a, p, 'notes'],
  unread: (a: string, p: string) => ['messages', a, p, 'unread'],
} }));
jest.mock('../notes', () => ({ listPinnedNotes: jest.fn(), pinMessage: jest.fn(), unpinMessage: jest.fn() }));
jest.mock('../commands', () => ({ setReadCursor: jest.fn(), deleteMessage: jest.fn() }));
jest.mock('../realtime', () => ({ subscribeMessages: jest.fn().mockResolvedValue(jest.fn()) }));
jest.mock('../useMessageDraft', () => ({ useMessageDraft: () => ({ body: '', pending: [], ready: true, error: null,
  changeBody: jest.fn(), send: jest.fn(), retry: jest.fn(), discard: jest.fn(), reconcile: mockReconcile }) }));
jest.mock('../../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
jest.mock('expo-router', () => ({ useIsFocused: () => true, Redirect: () => null }));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 0 }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'command' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
const mockReconcile = jest.fn().mockResolvedValue(undefined);
const account = { id: 'account', displayName: 'Alex', timezone: 'Europe/Warsaw', locale: 'en', status: 'active' as const, version: 1 };
const pair = { status: 'active' as const, pairId: 'pair', timezone: 'Europe/Warsaw', members: [
  { userId: 'account', displayName: 'Alex', slot: 'a' as const },
  { userId: 'partner', displayName: 'Sam', slot: 'b' as const },
] };
const message = { id: 'one', pairId: 'pair', authorId: 'partner', clientId: 'client', body: 'Hello from Sam',
  createdAt: '2026-10-04T12:00:00Z', pinnedAt: null, version: 1 };
beforeEach(() => {
  jest.clearAllMocks();
  AppState.currentState = 'active';
  jest.mocked(useAuth).mockReturnValue({ state: { status: 'authenticated', userId: account.id, account }, refresh: jest.fn(), retryStorage: jest.fn(), verifying: false, verifiedAt: 0 });
  jest.mocked(usePairGate).mockReturnValue({ account, pair, checking: false, error: null, online: true, refresh: jest.fn(), verifying: false });
  jest.mocked(listMessages).mockResolvedValue({ items: [message], nextCursor: null });
  jest.mocked(listPinnedNotes).mockResolvedValue([]);
  jest.mocked(setReadCursor).mockResolvedValue({ ok: true, data: { createdAt: message.createdAt, id: message.id } });
});
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const rendered = await render(<QueryClientProvider client={client}><MessagesScreen /></QueryClientProvider>);
  return { client, rendered };
}
it('does not query messages during an unverified pair check', async () => {
  jest.mocked(usePairGate).mockReturnValue({ account, pair: null, checking: true, error: null, online: true, refresh: jest.fn(), verifying: false });
  await mount();
  expect(listMessages).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Message')).toBeNull();
});
it('returns signed-out deep links to the account entry route', async () => {
  jest.mocked(useAuth).mockReturnValue({ state: { status: 'signedOut' }, refresh: jest.fn(), retryStorage: jest.fn(), verifying: false, verifiedAt: 0 });
  await mount();
  expect(listMessages).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Message')).toBeNull();
});
// Importance: 100. Fetching or scrolling older content must not read unseen messages.
it('advances the private cursor only after a durable row is visible', async () => {
  await mount();
  await waitFor(() => expect(screen.getByText(message.body)).toBeOnTheScreen());
  expect(setReadCursor).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId('conversation'), 'viewableItemsChanged', {
    viewableItems: [{ item: { kind: 'message', message }, isViewable: true }],
  });
  await waitFor(() => expect(setReadCursor).toHaveBeenCalledWith('pair', { createdAt: message.createdAt, id: message.id }));
});
// Importance: 95. Offline drafting must keep submission disabled.
it('keeps the composer available offline and disables Send', async () => {
  jest.mocked(usePairGate).mockReturnValue({ account, pair, checking: false, error: null, online: false, refresh: jest.fn(), verifying: false });
  await mount();
  expect(screen.getByLabelText('Message')).toHaveProp('editable', true);
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
});
// Importance: 95. New arrivals must preserve the reader position and offer an explicit jump.
it('offers New messages when fresh data arrives while reading older rows', async () => {
  const { client } = await mount();
  await waitFor(() => expect(screen.getByText(message.body)).toBeOnTheScreen());
  await fireEvent.scroll(screen.getByTestId('conversation'), { nativeEvent: {
    contentOffset: { y: 300, x: 0 }, contentSize: { width: 400, height: 1000 }, layoutMeasurement: { width: 400, height: 500 },
  } });
  await act(() => client.setQueryData(['messages', 'account', 'pair', 'conversation'], {
    pages: [{ items: [{ ...message, id: 'two', body: 'New arrival', createdAt: '2026-10-04T12:01:00Z' }, message], nextCursor: null }],
    pageParams: [undefined],
  }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'New messages' })).toBeOnTheScreen());
});
// Importance: 100. A realtime signal during an older-page request must still refresh the head.
it('refetches the head after an arrival during paging', async () => {
  let finishOlder!: (value: Awaited<ReturnType<typeof listMessages>>) => void;
  const older = { ...message, id: 'older', body: 'Older row', createdAt: '2026-10-04T11:59:00Z' };
  let arrival = false;
  jest.mocked(listMessages).mockImplementation(async (_pair, before) => {
    if (before) return new Promise(resolve => { finishOlder = resolve; });
    return { items: arrival ? [{ ...message, id: 'new', body: 'Arrived during paging', createdAt: '2026-10-04T12:01:00Z' }, message] : [message], nextCursor: 'older' };
  });
  const { client } = await mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Load older messages' })).toBeEnabled());
  await fireEvent.press(screen.getByRole('button', { name: 'Load older messages' }));
  await waitFor(() => expect(finishOlder).toBeDefined());
  arrival = true;
  await act(() => jest.mocked(subscribeMessages).mock.calls[0]![2]());
  jest.mocked(listMessages).mockImplementation(async (_pair, before) => before
    ? { items: [older], nextCursor: null }
    : { items: [{ ...message, id: 'new', body: 'Arrived during paging', createdAt: '2026-10-04T12:01:00Z' }, message], nextCursor: 'older' });
  await act(() => finishOlder({ items: [older], nextCursor: null }));
  await waitFor(() => expect(client.getQueryData(['messages', 'account', 'pair', 'conversation'])).toMatchObject({
    pages: [{ items: [expect.objectContaining({ id: 'new' }), expect.anything()] }, expect.anything()],
  }));
});
// Importance: 95. Realtime refresh must retain the loaded row under an older reader.
it.each([{ trigger: 'realtime', head: 121 }, { trigger: 'command', head: 181 }])(
  'keeps the oldest loaded boundary after a $trigger refresh', async ({ trigger, head }) => {
  let newest = 120;
  const row = (id: number) => ({ ...message, id: String(id), body: `Row ${id}`,
    createdAt: new Date(Date.UTC(2026, 9, 4) + id * 1000).toISOString() });
  jest.mocked(listMessages).mockImplementation(async (_pair, before) => {
    const top = before ? Number(before) - 1 : newest;
    const bottom = Math.max(1, top - 49);
    return { items: Array.from({ length: top - bottom + 1 }, (_, index) => row(top - index)),
      nextCursor: bottom > 1 ? String(bottom) : null };
  });
  const { client } = await mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Load older messages' })).toBeEnabled());
  await fireEvent.press(screen.getByRole('button', { name: 'Load older messages' }));
  await waitFor(() => expect(client.getQueryData(['messages', 'account', 'pair', 'conversation'])).toMatchObject({
    pages: [expect.anything(), expect.objectContaining({ nextCursor: '21' })],
  }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Load older messages' })).toBeEnabled());
  await fireEvent(screen.getByTestId('conversation'), 'viewableItemsChanged', {
    viewableItems: [{ item: { kind: 'message', message: row(21) }, isViewable: true }],
  });
  newest = head;
  if (trigger === 'realtime') await act(() => jest.mocked(subscribeMessages).mock.calls[0]![2]());
  else await act(() => client.invalidateQueries({ queryKey: ['messages', 'account', 'pair', 'conversation'] }));
  await waitFor(() => {
    const data = client.getQueryData<{ pages: { items: { id: string }[] }[] }>(['messages', 'account', 'pair', 'conversation']);
    const ids = data!.pages.flatMap(page => page.items.map(item => item.id));
    expect(ids).toContain(String(head));
    expect(ids).toContain('21');
  });
});
