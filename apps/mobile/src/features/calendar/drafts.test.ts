// Importance: 98. A restart must preserve retry IDs and the original edit version.
import { readEventDraft, writeEventDraft, removeEventDraft } from './drafts';
import { getPrivateStorage } from '../../lib/private-storage';

jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
const ids = { id: '74ff3de3-609c-43c3-bbd3-01e064593ba9', commandId: 'c8cf3be1-51dc-492e-85c6-4cfb634b4590' };
const values = { title: '', allDay: false, startDate: '', endDate: '', startTime: '', endTime: '', timezone: 'Europe/Warsaw', owner: 'a' as const, visibility: 'shared' as const, location: '', description: '' };
let setDraft: jest.Mock;
let getDraft: jest.Mock;
let removeDraft: jest.Mock;
beforeEach(() => {
  setDraft = jest.fn().mockResolvedValue(undefined);
  getDraft = jest.fn().mockResolvedValue(null);
  removeDraft = jest.fn().mockResolvedValue(undefined);
  jest.mocked(getPrivateStorage).mockResolvedValue({ setDraft, getDraft, removeDraft } as never);
});
it('round trips an incomplete draft with stable command ID and version', async () => {
  const draft = { ...ids, values, expectedVersion: 7 };
  await writeEventDraft('account', 'pair', 'key', draft);
  getDraft.mockResolvedValue(setDraft.mock.calls[0][3]);
  expect(await readEventDraft('account', 'pair', 'key')).toEqual(draft);
  expect(setDraft.mock.calls[0].slice(0, 3)).toEqual(['account', 'pair', 'key']);
});
it('reports encrypted storage failure instead of claiming a saved draft', async () => {
  setDraft.mockRejectedValue(new Error('storage failed'));
  await expect(writeEventDraft('account', 'pair', 'key', { ...ids, values })).rejects.toThrow('storage failed');
});
it('does not discard an unreadable draft', async () => {
  getDraft.mockResolvedValue('invalid JSON');
  await expect(readEventDraft('account', 'pair', 'key')).rejects.toThrow();
  expect(removeDraft).not.toHaveBeenCalled();
});
it('removes only the confirmed event draft', async () => {
  await removeEventDraft('account', 'pair', 'key');
  expect(removeDraft).toHaveBeenCalledWith('account', 'pair', 'key');
});
