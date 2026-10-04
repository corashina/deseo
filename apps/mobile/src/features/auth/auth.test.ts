// Importance: 100. Invalid codes and disabled accounts must not open private content.
// Importance: 98. Sign-out must clear drafts and caches even when revocation fails.
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn(), resetSupabaseClient: jest.fn() }));
jest.mock('../../lib/private-storage', () => ({ getPrivateStorage: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ resetPrivateQueries: jest.fn(), captureQueryScope: () => ({ assertCurrent: jest.fn() }) }));
jest.mock('../../lib/links', () => ({ clearPendingInvite: jest.fn() }));
jest.mock('../notifications', () => ({ revokeCurrentDevice: jest.fn().mockResolvedValue(undefined) }));
import { revokeCurrentDevice } from '../notifications';
import { getSupabase } from '../../lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getPrivateStorage } from '../../lib/private-storage';
import { resetPrivateQueries } from '../../lib/query-client';
import { requestEmailCode, verifyEmailCode, signOut, verifySensitiveAction } from './commands';
import { restoreSession } from './queries';

const id = '11111111-1111-4111-8111-111111111111';
const session = { user: { id }, access_token: 'token' };
const account = { id, displayName: 'Alex', timezone: 'Europe/Warsaw', locale: 'en', status: 'active', version: 1 };
let client: { auth: { getSession: jest.Mock; signInWithOtp: jest.Mock; verifyOtp: jest.Mock; signOut: jest.Mock }; rpc: jest.Mock; functions: { invoke: jest.Mock } };
let store: { clearSession: jest.Mock; purgeAccountDrafts: jest.Mock; getIntent: jest.Mock; removeIntent: jest.Mock };
beforeEach(() => {
  jest.clearAllMocks();
  client = { auth: { getSession: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
    verifyOtp: jest.fn().mockResolvedValue({ data: { session, user: session.user }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }) },
    rpc: jest.fn().mockResolvedValue({ data: { ok: true, data: { userId: id, account } }, error: null }), functions: { invoke: jest.fn() } };
  store = { clearSession: jest.fn(), purgeAccountDrafts: jest.fn(), getIntent: jest.fn().mockResolvedValue(id), removeIntent: jest.fn() };
  (getSupabase as jest.Mock).mockResolvedValue(client);
  (getPrivateStorage as jest.Mock).mockResolvedValue(store);
});
test('rejects malformed codes before contacting Auth', async () => {
  expect((await verifyEmailCode('alex@example.com', '123')).ok).toBe(false);
  expect(client.auth.verifyOtp).not.toHaveBeenCalled();
});
test('expired verification returns an error without validating or clearing invite intent', async () => {
  client.auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired' } });
  expect(await verifyEmailCode('alex@example.com', '123456')).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(client.rpc).not.toHaveBeenCalled();
});
test('server validation denies disabled accounts before restoration', async () => {
  client.rpc.mockResolvedValue({ data: { ok: true, data: { userId: id, account: { ...account, status: 'disabled' } } }, error: null });
  await expect(restoreSession()).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
test('restoration uses current server session checks', async () => {
  client.rpc.mockResolvedValue({ data: { ok: false, error: { code: 'UNAUTHENTICATED' } }, error: null });
  await expect(restoreSession()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  expect(client.rpc).toHaveBeenCalledWith('get_session_context');
});
test('storage failure prevents requesting a sign-in code', async () => {
  (getSupabase as jest.Mock).mockRejectedValue(new Error('storage failed'));
  expect((await requestEmailCode('alex@example.com')).ok).toBe(false);
  expect(client.auth.signInWithOtp).not.toHaveBeenCalled();
});
test('sign-out removes private state even if global revocation fails', async () => {
  client.auth.signOut.mockResolvedValue({ error: { status: 503 } });
  await expect(signOut('global')).rejects.toMatchObject({ code: 'RETRYABLE' });
  expect(resetPrivateQueries).toHaveBeenCalled();
  expect(store.purgeAccountDrafts).toHaveBeenCalledWith(id);
  expect(store.clearSession).toHaveBeenCalled();
});
test('sign-out after expiry removes drafts for the last signed-in account', async () => {
  client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  await signOut('local');
  expect(store.purgeAccountDrafts).toHaveBeenCalledWith(id);
  expect(store.removeIntent).toHaveBeenCalledWith('lastAccount');
});
// Importance: 100. Device ownership must end before the session is removed.
test('sign-out revokes only this installation for local scope', async () => {
  await signOut('local');
  expect(revokeCurrentDevice).toHaveBeenCalledWith(false);
  expect(jest.mocked(revokeCurrentDevice).mock.invocationCallOrder[0]).toBeLessThan(client.auth.signOut.mock.invocationCallOrder[0]!);
});
test('global sign-out revokes all devices even when Auth also fails', async () => {
  jest.mocked(revokeCurrentDevice).mockRejectedValueOnce(new Error('offline'));
  await expect(signOut('global')).rejects.toBeTruthy();
  expect(revokeCurrentDevice).toHaveBeenCalledWith(true);
  expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
  expect(store.clearSession).toHaveBeenCalled();
});
// Importance: 95. Proof responses must preserve server rejection codes and UTC timestamps.
test('action proof accepts the database offset timestamp without replacing the device session', async () => {
  const data = { proof: 'a'.repeat(64), expiresAt: '2026-10-04T14:30:00+00:00' };
  client.functions.invoke.mockResolvedValue({ data: { ok: true, data }, error: null });
  expect(await verifySensitiveAction('end_pair', '123456')).toEqual({ ok: true, data });
  expect(client.auth.verifyOtp).not.toHaveBeenCalled();
});
test('action proof preserves a failed HTTP result from the server', async () => {
  client.functions.invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError({ json: async () => ({ ok: false, error: { code: 'RATE_LIMITED' } }) }) });
  expect(await verifySensitiveAction('end_pair', '123456')).toEqual({ ok: false, error: { code: 'RATE_LIMITED' } });
});
