import { getPairContext } from './queries';
import { restorePairContext } from './queries';
import { getPrivateStorage } from '../../lib/private-storage';
import { createPair, acceptInvite, createInvite } from './commands';
import { getSupabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ assertCurrent() {}, signal: new AbortController().signal }), resetPrivateQueries: jest.fn() }));
jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('../../lib/links', () => ({ ...jest.requireActual('../../lib/links'), clearPendingInvite: jest.fn() }));
jest.mock('../auth', () => ({ timezoneSchema: jest.requireActual('zod').z.string() }));
const rpc = jest.fn();
const mockedClient = getSupabase as jest.Mock;
const pairId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const commandId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
beforeEach(() => { mockedClient.mockResolvedValue({ rpc }); rpc.mockReset(); });

// Importance: 100. Do not route into pair content after a denied or malformed membership response.
test('a denied membership fetch cannot return cached pair data', async () => {
  rpc.mockResolvedValue({ data: { ok: false, error: { code: 'FORBIDDEN' } }, error: null });
  await expect(getPairContext()).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
test('a malformed active pair cannot open protected screens', async () => {
  rpc.mockResolvedValue({ data: { ok: true, data: { status: 'active', pairId, timezone: 'UTC', members: [] } }, error: null });
  await expect(getPairContext()).rejects.toBeDefined();
});

// Importance: 98. Retry IDs must survive transport failures without duplicate pair creation.
test('pair creation preserves the command identifier on deliberate retry', async () => {
  rpc.mockResolvedValueOnce({ error: { status: 503 }, data: null })
    .mockResolvedValue({ data: { ok: true, data: { pairId } }, error: null });
  expect((await createPair('Europe/Warsaw', commandId)).ok).toBe(false);
  expect(await createPair('Europe/Warsaw', commandId)).toEqual({ ok: true, data: { pairId } });
  expect(rpc.mock.calls.map(call => call[1].p_command_id)).toEqual([commandId, commandId]);
});
test('invitation acceptance uses the normalized code without changing the retry identifier', async () => {
  rpc.mockResolvedValue({ data: { ok: true, data: { pairId } }, error: null });
  expect((await acceptInvite('abcd-1234-efgh', commandId)).ok).toBe(true);
  expect(rpc).toHaveBeenCalledWith('accept_invite', { p_token: 'ABCD1234EFGH', p_command_id: commandId });
});
test('a lost invitation response reports that the one-time token is unavailable', async () => {
  rpc.mockResolvedValue({ data: { ok: true, data: { token: null, expiresAt: '2026-10-05T00:00:00Z', alreadyDelivered: true } }, error: null });
  expect(await createInvite(pairId, commandId)).toMatchObject({ ok: true, data: { token: null, alreadyDelivered: true } });
});

// Importance: 100. A disconnect while the app is closed must remove the old pair's drafts on launch.
test('restoration removes a persisted old pair scope before exposing the ended state', async () => {
  const drafts = new Map([[pairId, 'private draft']]);
  (getPrivateStorage as jest.Mock).mockResolvedValue({ getIntent: async () => pairId,
    purgePairDrafts: async (_account: string, oldPair: string) => { drafts.delete(oldPair); }, removeIntent: async () => undefined });
  rpc.mockResolvedValue({ data: { ok: true, data: { status: 'ended', pairId, endedAt: '2026-10-04T00:00:00Z', ownExportDeadline: '2026-11-03T00:00:00Z' } }, error: null });
  expect((await restorePairContext('account-a')).status).toBe('ended');
  expect(drafts.size).toBe(0);
});
