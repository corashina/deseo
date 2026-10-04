// Importance: 98. Encrypted drafts preserve retry identity and reject another pair's payload.
import { readTaskDraft, writeTaskDraft } from './drafts';
import { getPrivateStorage } from '../../lib/private-storage';
jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
const account = '10000000-0000-4000-8000-000000000001';
const pair = '30000000-0000-4000-8000-000000000001';
const input = { id: '40000000-0000-4000-8000-000000000001', pairId: pair, listId: '60000000-0000-4000-8000-000000000001', title: 'Bread', assigneeId: null, dueDate: null };
const draft = { id: input.id, commandId: '50000000-0000-4000-8000-000000000001', expectedVersion: 3, values: { title: 'Bread', listId: input.listId, assigneeId: null, dueDate: '' }, submission: input };
const storage = { getDraft: jest.fn(), setDraft: jest.fn() };
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getPrivateStorage).mockResolvedValue(storage as never); storage.setDraft.mockResolvedValue(undefined); });
it('restores the stable submission, command, and expected version from the encrypted scope', async () => {
  await writeTaskDraft(account, pair, 'tasks:edit', draft);
  expect(storage.setDraft).toHaveBeenCalledWith(account, pair, 'tasks:edit', JSON.stringify(draft));
  storage.getDraft.mockResolvedValue(JSON.stringify(draft));
  expect(await readTaskDraft(account, pair, 'tasks:edit')).toEqual(draft);
});
it('rejects a submission from another pair before storage writes', async () => {
  await expect(writeTaskDraft(account, pair, 'tasks:edit', { ...draft, submission: { ...input, pairId: '30000000-0000-4000-8000-000000000002' } })).rejects.toThrow('scope changed');
  expect(storage.setDraft).not.toHaveBeenCalled();
});
it('does not silently discard unavailable storage', async () => {
  jest.mocked(getPrivateStorage).mockRejectedValue(new Error('Key unavailable'));
  await expect(readTaskDraft(account, pair, 'tasks:edit')).rejects.toThrow('Key unavailable');
});
// Importance: 98. Conflict review must retain local edits in encrypted storage after restart.
it('stores both the saved review values and preserved local values', async () => {
  const reviewing = { ...draft, values: { ...draft.values, title: 'Partner bread' }, submission: undefined,
    preservedValues: { ...draft.values, title: 'Local bread' } };
  await writeTaskDraft(account, pair, 'tasks:edit', reviewing);
  expect(storage.setDraft).toHaveBeenCalledWith(account, pair, 'tasks:edit', JSON.stringify(reviewing));
  storage.getDraft.mockResolvedValue(JSON.stringify(reviewing));
  expect(await readTaskDraft(account, pair, 'tasks:edit')).toEqual(reviewing);
});
