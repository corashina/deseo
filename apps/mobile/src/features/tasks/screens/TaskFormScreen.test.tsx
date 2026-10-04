// Importance: 98. Offline drafts, uncertain retries, and conflict review must preserve work.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskFormScreen } from './TaskFormScreen';
import { useCore } from '../../pair';
import { getTask } from '../queries';
import { createTask, updateTask } from '../commands';
import { readTaskDraft, writeTaskDraft } from '../drafts';
jest.mock('../../pair', () => ({ useCore: jest.fn() }), { virtual: true });
jest.mock('../TaskAccess', () => ({ TaskAccess: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../realtime', () => ({ useTaskSignals: jest.fn() }));
jest.mock('../queries', () => ({ getTask: jest.fn(), listTaskLists: jest.fn().mockResolvedValue([{ id: '60000000-0000-4000-8000-000000000001', name: 'General', isGeneral: true }]), taskKeys: { task: (account: string, pair: string, id: string) => ['tasks', account, pair, id], lists: (account: string, pair: string) => ['tasks', account, pair, 'lists'] } }));
jest.mock('../commands', () => ({ createTask: jest.fn(), updateTask: jest.fn() }));
jest.mock('../drafts', () => ({ readTaskDraft: jest.fn(), writeTaskDraft: jest.fn(), removeTaskDraft: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '50000000-0000-4000-8000-000000000001' }));
jest.mock('../../../components/ui/Screen', () => { const { View, Text } = jest.requireActual('react-native'); return { Screen: ({ title, children }: { title: string; children: React.ReactNode }) => <View><Text>{title}</Text>{children}</View> }; });
const accountId = '10000000-0000-4000-8000-000000000001';
const pairId = '30000000-0000-4000-8000-000000000001';
const task = { id: '40000000-0000-4000-8000-000000000001', pairId, listId: '60000000-0000-4000-8000-000000000001', authorId: accountId, title: 'Bread', assigneeId: null, dueDate: null, completedAt: null, completedBy: null, version: 3 };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useCore).mockReturnValue({ account: { id: accountId, displayName: 'Alex', timezone: 'Europe/Warsaw', locale: 'en', status: 'active', version: 1 }, pair: { status: 'active', pairId, timezone: 'Europe/Warsaw', members: [{ userId: accountId, displayName: 'Alex', slot: 'a' }, { userId: '10000000-0000-4000-8000-000000000002', displayName: 'Sam', slot: 'b' }] }, online: true, refresh: jest.fn() });
  jest.mocked(getTask).mockResolvedValue(task); jest.mocked(readTaskDraft).mockResolvedValue(null); jest.mocked(writeTaskDraft).mockResolvedValue(undefined);
});
async function mount(taskId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><TaskFormScreen taskId={taskId} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText('Title').props.editable).toBe(true)); return client;
}
it('requires saved-version review before restoring a conflict draft', async () => {
  jest.mocked(updateTask).mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  await mount(task.id);
  await fireEvent.changeText(screen.getByLabelText('Title'), 'Local bread');
  await fireEvent.press(screen.getByText('Save changes'));
  await waitFor(() => expect(screen.getByText('Reload saved version')).toBeTruthy());
  expect(updateTask).toHaveBeenCalledTimes(1);
  jest.mocked(getTask).mockResolvedValue({ ...task, title: 'Partner bread', version: 4 });
  await fireEvent.press(screen.getByText('Reload saved version'));
  await waitFor(() => expect(screen.getByLabelText('Title').props.value).toBe('Partner bread'));
  await fireEvent.press(screen.getByText('Restore my draft'));
  expect(screen.getByLabelText('Title').props.value).toBe('Local bread');
  expect(updateTask).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText('Save changes'));
  await waitFor(() => expect(jest.mocked(updateTask).mock.calls[1]?.[2]).toBe(4));
});
it('preserves uncertain submissions and retries the same IDs after restore', async () => {
  const input = { id: task.id, pairId, listId: task.listId, title: task.title, assigneeId: null, dueDate: null };
  jest.mocked(readTaskDraft).mockResolvedValue({ id: task.id, commandId: '50000000-0000-4000-8000-000000000009', values: { title: 'Bread', listId: task.listId, assigneeId: null, dueDate: '' }, submission: input });
  jest.mocked(createTask).mockResolvedValue({ ok: false, error: { code: 'RETRYABLE' } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(<QueryClientProvider client={client}><TaskFormScreen /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText('Title').props.editable).toBe(false));
  const retries = screen.getAllByText('Retry save');
  await fireEvent.press(retries[retries.length - 1]!);
  await waitFor(() => expect(createTask).toHaveBeenCalledWith(input, '50000000-0000-4000-8000-000000000009'));
});
it('allows editing offline but disables submission', async () => {
  const base = jest.mocked(useCore)(); jest.mocked(useCore).mockReturnValue({ ...base, online: false });
  await mount();
  await fireEvent.changeText(screen.getByLabelText('Title'), 'Offline bread');
  expect(screen.getByRole('button', { name: 'Add task' }).props.accessibilityState.disabled).toBe(true);
  await waitFor(() => expect(writeTaskDraft).toHaveBeenCalled());
  expect(createTask).not.toHaveBeenCalled();
});
