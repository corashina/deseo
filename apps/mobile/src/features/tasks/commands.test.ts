// Importance: 98. Desired completion and stable retries protect shared work.
import { createTask, updateTask, setTaskCompleted, createList, renameList } from './commands';
import { taskInputSchema } from '@deseo/domain/tasks';
import { getSupabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ signal: new AbortController().signal, assertCurrent: jest.fn() }), queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) } }));
const id = '40000000-0000-4000-8000-000000000001';
const pairId = '30000000-0000-4000-8000-000000000001';
const listId = '60000000-0000-4000-8000-000000000001';
const command = '50000000-0000-4000-8000-000000000001';
const input = { id, pairId, listId, title: 'Buy bread', assigneeId: null, dueDate: null };
const row = { id, pair_id: pairId, list_id: listId, title: input.title, assignee_id: null, due_date: null, created_by: id, completed_at: null, completed_by: null, version: 1 };
const rpc = jest.fn();
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getSupabase).mockResolvedValue({ rpc } as never); rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: { ok: true, data: row }, error: null }) }); });
it('sends the same source and command IDs on retry', async () => {
  await createTask(input, command); await createTask(input, command);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(rpc.mock.calls[0][1].p_input.id).toBe(id);
});
it('uses explicit desired states for completion and Undo', async () => {
  await setTaskCompleted(id, true, 1, command);
  expect(rpc).toHaveBeenLastCalledWith('set_task_completed', { p_task_id: id, p_completed: true, p_expected_version: 1, p_command_id: command });
  await setTaskCompleted(id, false, 2, command);
  expect(rpc.mock.calls[1][1].p_completed).toBe(false);
});
it('returns conflicts without resubmitting or overwriting', async () => {
  rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: { ok: false, error: { code: 'CONFLICT' } }, error: null }) });
  expect(await updateTask(id, input, 1, command)).toEqual({ ok: false, error: { code: 'CONFLICT' } });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('rejects changed IDs and invalid versions before RPC', async () => {
  expect((await updateTask(listId, input, 1, command)).ok).toBe(false);
  expect((await setTaskCompleted(id, true, 0, command)).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it('rejects impossible due dates', () => {
  expect(taskInputSchema.safeParse({ ...input, dueDate: '2026-02-30' }).success).toBe(false);
});
it('trims list names and preserves the command UUID', async () => {
  rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: { ok: true, data: { id: command, pair_id: pairId, name: 'Groceries', is_general: false, created_by: id, version: 1 } }, error: null }) });
  expect((await createList(pairId, ' Groceries ', command)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledWith('create_list', { p_pair_id: pairId, p_name: 'Groceries', p_command_id: command });
});
// Importance: 95. A rename must carry the version that the user reviewed.
it('sends and validates the expected list version', async () => {
  rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: { ok: true, data: { id: listId, pair_id: pairId, name: 'Shopping', is_general: false, created_by: id, version: 4 } }, error: null }) });
  expect((await renameList(listId, ' Shopping ', 3, command)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledWith('rename_list', { p_list_id: listId, p_name: 'Shopping', p_expected_version: 3, p_command_id: command });
  expect((await renameList(listId, 'Shopping', 0, command)).ok).toBe(false);
  expect(rpc).toHaveBeenCalledTimes(1);
});
