// Importance: 93. Native checkboxes must expose state and preserve large text.
// Importance: 98. Failed completion restores state and retries the same command.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TaskRow } from './TaskRow';
import { setTaskCompleted } from '../commands';
jest.mock('../commands', () => ({ setTaskCompleted: jest.fn() }));
jest.mock('../actions', () => ({ readTaskAction: jest.fn().mockResolvedValue(null), writeTaskAction: jest.fn().mockResolvedValue(undefined), removeTaskAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '50000000-0000-4000-8000-000000000001' }));
const task = { id: '40000000-0000-4000-8000-000000000001', pairId: '30000000-0000-4000-8000-000000000001', listId: '60000000-0000-4000-8000-000000000001', authorId: '10000000-0000-4000-8000-000000000001', title: 'Buy bread for the week and share breakfast', assigneeId: null, dueDate: null, completedAt: null, completedBy: null, version: 1 };
it('uses a full label checkbox with wrapping text', async () => {
  await render(<TaskRow task={task} accountId={task.authorId} assignee="Unassigned" online onOpen={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject({ checked: false, disabled: false }));
  expect(screen.getByText(task.title).props.numberOfLines).toBeUndefined();
});
it('rolls back failed completion and keeps Retry and Undo explicit', async () => {
  jest.mocked(setTaskCompleted).mockResolvedValueOnce({ ok: false, error: { code: 'RETRYABLE' } }).mockResolvedValueOnce({ ok: true, data: { ...task, completedAt: '2026-10-04T12:00:00Z', completedBy: task.authorId, version: 2 } });
  await render(<TaskRow task={task} accountId={task.authorId} assignee="Unassigned" online onOpen={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject({ disabled: false }));
  await fireEvent.press(screen.getByRole('checkbox'));
  await waitFor(() => expect(screen.getByRole('checkbox').props.accessibilityState).toMatchObject({ checked: false }));
  await fireEvent.press(screen.getByText('Retry'));
  await waitFor(() => expect(screen.getByText('Undo')).toBeTruthy());
  expect(jest.mocked(setTaskCompleted).mock.calls[0]).toEqual(jest.mocked(setTaskCompleted).mock.calls[1]);
});
