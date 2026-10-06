// Importance: 100. Lost responses and account changes must not duplicate sends or restore revoked drafts.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useMessageDraft } from './useMessageDraft';
import { loadMessageDraft, saveMessageDraft } from './drafts';
import { sendMessage } from './commands';
import { reconcileMessageSends } from './queries';
import { flushPrivateDrafts } from '../../lib/draft';

const mockAssertCurrent = jest.fn();
jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent: mockAssertCurrent }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '10000000-0000-4000-8000-000000000001' }));
jest.mock('./drafts', () => ({ loadMessageDraft: jest.fn(), saveMessageDraft: jest.fn() }));
jest.mock('./commands', () => ({ sendMessage: jest.fn() }));
jest.mock('./queries', () => ({ reconcileMessageSends: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(loadMessageDraft).mockResolvedValue({ body: '', pending: [] });
  jest.mocked(saveMessageDraft).mockResolvedValue(undefined);
  jest.mocked(sendMessage).mockResolvedValue({ ok: false, error: { code: 'RETRYABLE' } });
  jest.mocked(reconcileMessageSends).mockResolvedValue({ messages: [], deletedClientIds: [] });
});
async function mount() {
  const hook = await renderHook(() => useMessageDraft('account', 'pair', true));
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
}
it('persists before sending and reuses the failed UUID without sending the next draft', async () => {
  const hook = await mount();
  await act(() => hook.result.current.changeBody('First message'));
  await act(() => hook.result.current.send());
  expect(sendMessage).toHaveBeenCalledTimes(1);
  const first = jest.mocked(sendMessage).mock.calls[0]![0];
  expect(saveMessageDraft).toHaveBeenCalledWith('account', 'pair', expect.objectContaining({
    pending: [expect.objectContaining({ clientId: first.clientId, body: 'First message', state: 'sending' })],
  }));
  const persisted = jest.mocked(saveMessageDraft).mock.invocationCallOrder;
  expect(persisted[0]).toBeLessThan(jest.mocked(sendMessage).mock.invocationCallOrder[0]!);
  await act(() => hook.result.current.changeBody('Next draft'));
  await act(() => hook.result.current.retry(first.clientId));
  expect(jest.mocked(sendMessage).mock.calls[1]![0]).toEqual(first);
  expect(hook.result.current.body).toBe('Next draft');
  expect(hook.result.current.pending[0]!.state).toBe('failed');
});
// Importance: 95. The composer must accept the same 4,000-character range as the server.
it('sends 4,000 Unicode characters without counting surrogate pairs twice', async () => {
  const hook = await mount();
  const body = '😀'.repeat(4000);
  await act(() => hook.result.current.changeBody(body));
  await act(() => hook.result.current.send());
  expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ body }));
});
// Importance: 98. Do not submit a message if encrypted storage cannot preserve its UUID.
it('keeps text and blocks sending when draft storage fails', async () => {
  const hook = await mount();
  jest.mocked(saveMessageDraft).mockRejectedValue(new Error('storage'));
  await act(() => hook.result.current.changeBody('Keep this text'));
  await act(() => hook.result.current.send());
  expect(sendMessage).not.toHaveBeenCalled();
  expect(hook.result.current.pending[0]!.body).toBe('Keep this text');
  expect(hook.result.current.error).toMatch(/draft/);
});
it('drops an acknowledged or deleted pending UUID after reconnect without automatic resubmission', async () => {
  jest.mocked(loadMessageDraft).mockResolvedValue({ body: 'Next draft', pending: [
    { clientId: 'sent', body: 'Lost response', state: 'failed' },
    { clientId: 'deleted', body: 'Deleted elsewhere', state: 'failed' },
  ] });
  jest.mocked(reconcileMessageSends).mockResolvedValue({ messages: [
    { id: 'server', pairId: 'pair', clientId: 'sent', authorId: 'account', body: 'Lost response',
      createdAt: '2026-10-04T12:00:00Z', pinnedAt: null, version: 1 },
  ], deletedClientIds: ['deleted'] });
  const hook = await mount();
  await act(() => hook.result.current.reconcile());
  expect(hook.result.current.pending).toEqual([]);
  expect(hook.result.current.body).toBe('Next draft');
  expect(sendMessage).not.toHaveBeenCalled();
});
it('does not persist a late send response after access resets', async () => {
  let complete!: (value: Awaited<ReturnType<typeof sendMessage>>) => void;
  jest.mocked(sendMessage).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  const hook = await mount();
  await act(() => hook.result.current.changeBody('Pending'));
  let sending!: Promise<void>;
  await act(() => { sending = hook.result.current.send(); });
  await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
  const writes = jest.mocked(saveMessageDraft).mock.calls.length;
  mockAssertCurrent.mockImplementation(() => { throw new Error('access reset'); });
  await act(async () => { complete({ ok: false, error: { code: 'UNAUTHENTICATED' } }); await sending; });
  expect(saveMessageDraft).toHaveBeenCalledTimes(writes);
});
// Importance: 98. Background flushing must preserve the most recent input.
it('flushes current input before background access resets', async () => {
  const hook = await mount();
  await act(() => hook.result.current.changeBody('Latest input'));
  await act(() => flushPrivateDrafts());
  expect(saveMessageDraft).toHaveBeenLastCalledWith('account', 'pair', { body: 'Latest input', pending: [] });
});
