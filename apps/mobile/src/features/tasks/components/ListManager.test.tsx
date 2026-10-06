// Importance: 98. List conflicts and uncertain retries must preserve entered names across restart.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ListManager } from './ListManager';
import { renameList } from '../commands';
import { listTaskLists } from '../queries';
import { getPrivateStorage } from '../../../lib/private-storage';
import { randomUUID } from 'expo-crypto';
import type { TaskList } from '@deseo/domain/tasks';

jest.mock('../commands', () => ({ renameList: jest.fn(), createList: jest.fn(), deleteEmptyList: jest.fn(), moveListTasksToGeneral: jest.fn() }));
jest.mock('../queries', () => ({ listTaskLists: jest.fn() }));
jest.mock('../../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('../../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '50000000-0000-4000-8000-000000000001') }));
const accountId = '10000000-0000-4000-8000-000000000001';
const pairId = '30000000-0000-4000-8000-000000000001';
const list: TaskList = { id: '60000000-0000-4000-8000-000000000001', pairId, name: 'Groceries', isGeneral: false, authorId: accountId, version: 3 };
let stored: Map<string, string>;
beforeEach(() => {
  jest.clearAllMocks(); stored = new Map();
  let ids = 0; jest.mocked(randomUUID).mockReset().mockImplementation(() => `50000000-0000-4000-8000-00000000000${++ids}` as never);
  jest.mocked(getPrivateStorage).mockResolvedValue({
    getDraft: async (_account: string, _pair: string, key: string) => stored.get(key) ?? null,
    setDraft: async (_account: string, _pair: string, key: string, value: string) => { stored.set(key, value); },
    removeDraft: async (_account: string, _pair: string, key: string) => { stored.delete(key); },
  } as never);
  jest.mocked(listTaskLists).mockResolvedValue([{ ...list, name: 'Partner shopping', version: 4 }]);
});
async function mount(current = list) {
  const view = await render(<ListManager accountId={accountId} pairId={pairId} list={current} online />);
  await waitFor(() => expect(screen.getByLabelText('List name').props.editable).toBe(true));
  return view;
}

// Importance: 98. Live refresh must not replace the edit's starting version.
it('retains the opened version while the partner refreshes the list', async () => {
  jest.mocked(renameList).mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  const view = await mount();
  await fireEvent.changeText(screen.getByLabelText('List name'), 'Local shopping');
  await view.rerender(<ListManager accountId={accountId} pairId={pairId} list={{ ...list, version: 4, name: 'Partner shopping' }} online />);
  await fireEvent.press(screen.getByText('Rename list'));
  await waitFor(() => expect(renameList).toHaveBeenCalledWith(list.id, 'Local shopping', 3, '50000000-0000-4000-8000-000000000001'));
  await waitFor(() => expect(screen.getByText('Reload saved version')).toBeTruthy());
  expect(screen.getByLabelText('List name').props.value).toBe('Local shopping');
});

// Importance: 98. Both conflict stages must preserve the entered name after restart.
it('restores conflict review and entered names through two restarts', async () => {
  jest.mocked(renameList).mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  await mount();
  await fireEvent.changeText(screen.getByLabelText('List name'), 'Local shopping');
  await fireEvent.press(screen.getByText('Rename list'));
  await waitFor(() => expect(screen.getByText('Reload saved version')).toBeTruthy());
  await screen.unmount();
  await render(<ListManager accountId={accountId} pairId={pairId} list={{ ...list, version: 4 }} online />);
  await waitFor(() => expect(screen.getByText('Reload saved version')).toBeTruthy());
  expect(screen.getByLabelText('List name').props.value).toBe('Local shopping');
  await fireEvent.press(screen.getByText('Reload saved version'));
  await waitFor(() => expect(screen.getByLabelText('List name').props.value).toBe('Partner shopping'));
  expect(screen.getByRole('button', { name: 'Rename list' }).props.accessibilityState.disabled).toBe(true);
  await screen.unmount();
  await render(<ListManager accountId={accountId} pairId={pairId} list={{ ...list, version: 5 }} online />);
  await waitFor(() => expect(screen.getByText('Restore my draft')).toBeTruthy());
  expect(screen.getByLabelText('List name').props.value).toBe('Partner shopping');
  await fireEvent.press(screen.getByText('Restore my draft'));
  await waitFor(() => expect(screen.getByLabelText('List name').props.value).toBe('Local shopping'));
  expect(renameList).toHaveBeenCalledTimes(1);
  jest.mocked(renameList).mockResolvedValue({ ok: true, data: { ...list, name: 'Local shopping', version: 5 } });
  await fireEvent.press(screen.getByText('Rename list'));
  await waitFor(() => expect(jest.mocked(renameList).mock.calls[1]?.[2]).toBe(4));
  expect(jest.mocked(renameList).mock.calls[1]?.[3]).not.toBe(jest.mocked(renameList).mock.calls[0]?.[3]);
});

// Importance: 98. An unsent draft must retain its version when the saved name changes during restart.
it('restores an unsent name draft with its opened version', async () => {
  await mount();
  await fireEvent.changeText(screen.getByLabelText('List name'), 'Local shopping');
  await waitFor(() => expect(stored.get(`tasks:list-name:${list.id}`)).toContain('Local shopping'));
  await screen.unmount();
  await mount({ ...list, name: 'Partner shopping', version: 4 });
  expect(screen.getByLabelText('List name').props.value).toBe('Local shopping');
  jest.mocked(renameList).mockResolvedValue({ ok: false, error: { code: 'CONFLICT' } });
  await fireEvent.press(screen.getByText('Rename list'));
  await waitFor(() => expect(renameList).toHaveBeenCalledWith(list.id, 'Local shopping', 3, '50000000-0000-4000-8000-000000000001'));
});

// Importance: 98. A lost response must retry its original command, name, and version.
it('retries the original uncertain rename after restart', async () => {
  jest.mocked(renameList).mockResolvedValue({ ok: false, error: { code: 'RETRYABLE' } });
  await mount();
  await fireEvent.changeText(screen.getByLabelText('List name'), 'Local shopping');
  await fireEvent.press(screen.getByText('Rename list'));
  await waitFor(() => expect(screen.getByText('Retry save')).toBeTruthy());
  const original = jest.mocked(renameList).mock.calls[0];
  await screen.unmount();
  await render(<ListManager accountId={accountId} pairId={pairId} list={{ ...list, name: 'Partner shopping', version: 4 }} online />);
  await waitFor(() => expect(screen.getByText('Retry save')).toBeTruthy());
  expect(screen.getByLabelText('List name').props.editable).toBe(false);
  expect(screen.getByLabelText('List name').props.value).toBe('Local shopping');
  await fireEvent.press(screen.getByText('Retry save'));
  await waitFor(() => expect(renameList).toHaveBeenCalledTimes(2));
  expect(jest.mocked(renameList).mock.calls[1]).toEqual(original);
  expect(original?.[2]).toBe(3);
});

// Importance: 95. A taken name is a field error, not a partner conflict.
it('shows a taken name on the field and keeps the name editable', async () => {
  jest.mocked(renameList).mockResolvedValue({ ok: false, error: { code: 'CONFLICT', field: 'name' } });
  await mount();
  await fireEvent.changeText(screen.getByLabelText('List name'), 'Shopping');
  await fireEvent.press(screen.getByText('Rename list'));
  await waitFor(() => expect(screen.getByText('This value is already in use.')).toBeTruthy());
  expect(screen.queryByText('Reload saved version')).toBeNull();
  expect(screen.getByLabelText('List name').props.editable).toBe(true);
});
