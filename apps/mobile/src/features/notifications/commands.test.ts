// Importance: 100. Notification inputs must not create cross-source reminders or unsafe routes.
import { setReminder, resolveNotification, registerDevice } from './commands';
import { getSupabase } from '../../lib/supabase';
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: () => ({ signal: new AbortController().signal, assertCurrent: jest.fn() }),
  queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) } }));
const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
const commandId = 'c8cf3be1-51dc-492e-85c6-4cfb634b4590';
let rpc: jest.Mock;
beforeEach(() => { rpc = jest.fn(() => ({ abortSignal: jest.fn().mockResolvedValue({ data: { ok: true, data: { kind: 'event', id, pairId } }, error: null }) }));
  jest.mocked(getSupabase).mockResolvedValue({ rpc } as never); });
test('rejects a reminder with two sources before sending it', async () => {
  expect(await setReminder({ id, pairId, eventId: id, taskId: id, minutesBefore: 15, remindAt: null, active: true, expectedVersion: null }, commandId))
    .toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(rpc).not.toHaveBeenCalled();
});
test('rejects a denied device carrying a push token', async () => {
  expect(await registerDevice({ installationId: id, token: 'ExpoPushToken[test]', platform: 'ios', permission: 'denied' }))
    .toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(rpc).not.toHaveBeenCalled();
});
test('resolves only an opaque notification id through the backend', async () => {
  expect(await resolveNotification(id)).toEqual({ ok: true, data: { kind: 'event', id, pairId } });
  expect(rpc.mock.calls[0]).toEqual(['resolve_notification', { p_id: id }]);
});
test('rejects a forged backend destination', async () => {
  rpc.mockImplementation(() => ({ abortSignal: jest.fn().mockResolvedValue({ data: { ok: true, data: { kind: 'url', id, pairId, url: 'https://evil.test' } }, error: null }) }));
  expect((await resolveNotification(id)).ok).toBe(false);
});
test('keeps the command id after an uncertain reminder save', async () => {
  const input = { id, pairId, eventId: id, taskId: null, minutesBefore: 15, remindAt: null, active: true, expectedVersion: null };
  rpc.mockImplementation(() => ({ abortSignal: jest.fn().mockRejectedValue(new Error('timeout')) }));
  await setReminder(input, commandId); await setReminder(input, commandId);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(rpc.mock.calls[0][1]).toEqual({ p_input: input, p_command_id: commandId });
});
