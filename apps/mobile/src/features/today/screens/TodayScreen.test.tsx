// Importance: 95. Today must show confirmed feature records and preserve independent failure states.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Settings } from 'luxon';
import { router } from 'expo-router';
import { TodayScreen } from './TodayScreen';
import { getToday } from '../queries';
import { listDueTasks, taskKeys } from '../../tasks';
import { listPinnedNotes } from '../../messages';
import { latestMemory } from '../../memories';
import { listImportantDates } from '../../calendar';
import { listNotifications, notificationKeys } from '../../notifications';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('../queries', () => ({ getToday: jest.fn() }));
jest.mock('../../notifications', () => ({ listNotifications: jest.fn(), notificationKeys: { list: (...parts: string[]) => ['notifications', ...parts, 'list'] } }));
jest.mock('../../pair', () => ({ useCore: () => ({ account: mockAccount, pair: mockPair, online: true }) }));
jest.mock('../../calendar', () => ({
  listImportantDates: jest.fn(), calendarKeys: { all: (...parts: string[]) => ['calendar', ...parts] },
  nextImportantDate: (rows: unknown[]) => rows[0], importantDateCountdown: () => 1,
  EventRow: () => null,
}));
jest.mock('../../tasks', () => {
  const { Text, Pressable } = jest.requireActual('react-native');
  return { listDueTasks: jest.fn(), getTask: jest.fn().mockImplementation(async () => ({ ...task, completedAt: '2026-10-05T00:00:00Z' })),
    taskKeys: { due: (...parts: string[]) => ['tasks', ...parts], task: (...parts: string[]) => ['tasks', ...parts, 'task'] },
    TaskRow: ({ task, onCompleted }: { task: { title: string; completedAt: string | null }; onCompleted: (value: object) => void }) =>
      <Pressable accessibilityRole="button" accessibilityLabel={task.completedAt ? 'Undo' : 'Complete task'}
        onPress={() => onCompleted({ ...task, completedAt: task.completedAt ? null : '2026-10-05T00:00:00Z' })}>
        <Text>{task.title}</Text>
      </Pressable> };
});
jest.mock('../../messages', () => {
  const { Text, Pressable } = jest.requireActual('react-native');
  return { listPinnedNotes: jest.fn(), messageKeys: { notes: (...parts: string[]) => ['messages', ...parts, 'notes'] },
    NoteCard: ({ message, onReply }: { message: { body: string }; onReply: () => void }) =>
      <Pressable accessibilityRole="button" accessibilityLabel="Reply" onPress={onReply}><Text>{message.body}</Text></Pressable> };
});
jest.mock('../../memories', () => {
  const { Text } = jest.requireActual('react-native');
  return { latestMemory: jest.fn(), memoryKeys: { latest: (...parts: string[]) => ['memories', ...parts, 'latest'] },
    MemoryAccessBoundary: ({ children }: { children: React.ReactNode }) => mockMemoryReady ? children : null,
    MemoryCard: ({ memory }: { memory: { caption: string } }) => <Text>{memory.caption}</Text> };
});
const mockAccount = { id: 'account', displayName: 'Alex', timezone: 'America/Los_Angeles' };
const mockPair = { status: 'active', pairId: 'pair', timezone: 'Europe/Warsaw', members: [
  { userId: 'account', displayName: 'Alex', slot: 'a' }, { userId: 'partner', displayName: 'Sam', slot: 'b' },
] };
const task = { id: 'task', pairId: 'pair', title: 'Bring flowers', assigneeId: 'partner', completedAt: null };
let mockMemoryReady = true;
beforeEach(() => {
  jest.clearAllMocks(); mockMemoryReady = true; Settings.now = () => Date.parse('2026-10-04T23:00:00Z');
  jest.mocked(listNotifications).mockResolvedValue({ items: [], nextCursor: null });
  jest.mocked(getToday).mockResolvedValue({ pair: mockPair, agenda: [] } as never);
  jest.mocked(listDueTasks).mockResolvedValue([task] as never);
  jest.mocked(listPinnedNotes).mockResolvedValue([{ id: 'note', authorId: 'partner', body: 'See you tonight' }] as never);
  jest.mocked(latestMemory).mockResolvedValue({ id: 'memory', createdBy: 'partner', caption: 'Our day at the sea' } as never);
  jest.mocked(listImportantDates).mockResolvedValue([{ id: 'date', title: 'Our anniversary', temporal: { kind: 'allDay', startDate: '2026-10-06' } }] as never);
});
afterEach(() => { Settings.now = () => Date.now(); });
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><TodayScreen /></QueryClientProvider>);
  return client;
}
it('uses the pair date and opens the shared conversation from its latest note', async () => {
  await mount();
  await waitFor(() => expect(screen.getByText('Our day at the sea')).toBeOnTheScreen());
  expect(screen.getByText('See you tonight')).toBeOnTheScreen();
  expect(screen.getByText('Bring flowers')).toBeOnTheScreen();
  expect(screen.getByText('Our anniversary')).toBeOnTheScreen();
  expect(listDueTasks).toHaveBeenCalledWith('pair', '2026-10-05');
  await fireEvent.press(screen.getByRole('button', { name: 'Reply' }));
  expect(router.push).toHaveBeenCalledWith('/(tabs)/messages');
});
it('keeps loaded content when the note query fails', async () => {
  jest.mocked(listPinnedNotes).mockRejectedValue(new Error('Offline'));
  await mount();
  await waitFor(() => expect(screen.getByText('We could not load your note.')).toBeOnTheScreen());
  expect(screen.getByText('Our day at the sea')).toBeOnTheScreen();
  expect(screen.getByText('Bring flowers')).toBeOnTheScreen();
});
it('keeps Undo when a completed task leaves the due query', async () => {
  const client = await mount();
  await waitFor(() => expect(screen.getByText('Bring flowers')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: 'Complete task' }));
  await act(() => client.setQueryData(taskKeys.due('account', 'pair', '2026-10-05'), []));
  expect(screen.getByRole('button', { name: 'Undo' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
});
// Importance: 95. A partner can undo completion while Today retains the completion action.
it('shows a task again after the partner removes its completed state', async () => {
  const client = await mount();
  await waitFor(() => expect(screen.getByText('Bring flowers')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: 'Complete task' }));
  await waitFor(() => expect(client.isFetching({ queryKey: taskKeys.task('account', 'pair', 'task') })).toBe(0));
  await act(() => {
    client.setQueryData(taskKeys.task('account', 'pair', 'task'), task);
    client.setQueryData(taskKeys.due('account', 'pair', '2026-10-05'), [task]);
  });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Complete task' })).toBeOnTheScreen());
});
// Importance: 100. Retained Undo controls must not expose a deleted task.
it('removes the completed row after durable deletion', async () => {
  const client = await mount();
  await waitFor(() => expect(screen.getByText('Bring flowers')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: 'Complete task' }));
  await waitFor(() => expect(client.isFetching({ queryKey: taskKeys.task('account', 'pair', 'task') })).toBe(0));
  await act(() => {
    client.setQueryData(taskKeys.task('account', 'pair', 'task'), null);
    client.setQueryData(taskKeys.due('account', 'pair', '2026-10-05'), []);
  });
  await waitFor(() => expect(screen.queryByText('Bring flowers')).toBeNull());
});
// Importance: 100. Memory data must load inside the media access boundary and be discarded with it.
it('waits for memory access before loading the latest memory', async () => {
  mockMemoryReady = false;
  await mount();
  await waitFor(() => expect(screen.getByText('Bring flowers')).toBeOnTheScreen());
  expect(latestMemory).not.toHaveBeenCalled();
});
// Importance: 95. Today and Notifications must share the same paging shape and unread state.
it('opens notifications and removes New after the shared cache marks recent items read', async () => {
  jest.mocked(listNotifications).mockResolvedValue({ items: [{ id: 'notification', readAt: null }], nextCursor: null } as never);
  const client = await mount();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications, new' })).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: 'Notifications, new' }));
  expect(router.push).toHaveBeenCalledWith('/notifications');
  await act(() => client.setQueryData(notificationKeys.list('account', 'pair'), {
    pages: [{ items: [{ id: 'notification', readAt: '2026-10-05T00:00:00Z' }], nextCursor: null }], pageParams: [null],
  }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeOnTheScreen());
});
