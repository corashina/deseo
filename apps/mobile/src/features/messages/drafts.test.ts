// Importance: 95. Restart and storage failures must preserve original message text and retry IDs.
import { loadMessageDraft, saveMessageDraft } from './drafts';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';
import { AppError } from '@deseo/domain/result';
import type { MessageDraft } from './types';

jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: jest.fn() }));
const accountId = '741dd351-3376-4622-a9bd-ab9ced5fac8d';
const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
const clientId = 'c8cf3be1-51dc-492e-85c6-4cfb634b4590';
const draft: MessageDraft = { body: 'unfinished\n', pending: [{ clientId, body: ' original text ', state: 'sending' }] };
let getDraft: jest.Mock; let setDraft: jest.Mock; let removeDraft: jest.Mock; let assertCurrent: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  getDraft = jest.fn().mockResolvedValue(null);
  setDraft = jest.fn().mockResolvedValue(undefined);
  removeDraft = jest.fn().mockResolvedValue(undefined);
  assertCurrent = jest.fn();
  jest.mocked(getPrivateStorage).mockResolvedValue({ getDraft, setDraft, removeDraft } as never);
  jest.mocked(captureQueryScope).mockReturnValue({ signal: new AbortController().signal, assertCurrent });
});

it('restores an interrupted send as failed while preserving its body and UUID', async () => {
  await saveMessageDraft(accountId, pairId, draft);
  expect(setDraft).toHaveBeenCalledWith(accountId, pairId, 'messages', JSON.stringify(draft));
  getDraft.mockResolvedValue(setDraft.mock.calls[0][3]);
  expect(await loadMessageDraft(accountId, pairId)).toEqual({ ...draft, pending: [{ ...draft.pending[0], state: 'failed' }] });
  expect(getDraft).toHaveBeenCalledWith(accountId, pairId, 'messages');
  expect(draft.pending[0]?.state).toBe('sending');
});

it('preserves a draft containing 4,000 Unicode characters', async () => {
  const fullDraft = { body: '😀'.repeat(4000), pending: [] };
  await saveMessageDraft(accountId, pairId, fullDraft);
  getDraft.mockResolvedValue(setDraft.mock.calls[0][3]);
  expect((await loadMessageDraft(accountId, pairId)).body.length).toBe(8000);
});

it('does not discard an unreadable draft or hide a failed encrypted write', async () => {
  getDraft.mockResolvedValue('invalid JSON');
  await expect(loadMessageDraft(accountId, pairId)).rejects.toThrow();
  setDraft.mockRejectedValue(new Error('storage failed'));
  await expect(saveMessageDraft(accountId, pairId, draft)).rejects.toThrow('storage failed');
  expect(removeDraft).not.toHaveBeenCalled();
});

it('removes only this conversation draft after its content is cleared', async () => {
  await saveMessageDraft(accountId, pairId, { body: '', pending: [] });
  expect(removeDraft).toHaveBeenCalledWith(accountId, pairId, 'messages');
  expect(setDraft).not.toHaveBeenCalled();
});

// Importance: 100. A revoked scope must not restore or write private drafts.
it('rejects a draft write if access changes before storage opens', async () => {
  assertCurrent.mockImplementation(() => { throw new AppError({ code: 'UNAUTHENTICATED' }); });
  await expect(saveMessageDraft(accountId, pairId, draft)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  expect(setDraft).not.toHaveBeenCalled();
  expect(removeDraft).not.toHaveBeenCalled();
});

it('rejects fetched rows in the draft format', async () => {
  const fetched = { ...draft.pending[0]!, id: clientId, createdAt: '2026-10-04T10:00:00Z' };
  await expect(saveMessageDraft(accountId, pairId, { body: '', pending: [fetched] })).rejects.toThrow();
  expect(setDraft).not.toHaveBeenCalled();
});
