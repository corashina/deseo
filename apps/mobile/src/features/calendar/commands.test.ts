// Importance: 98. Failed retries must not duplicate events or overwrite another edit.
import { createEvent, updateEvent, deleteEvent } from './commands';
import { getSupabase } from '../../lib/supabase';
import { listAgenda } from './queries';
import type { EventInput } from './types';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => ({
  captureQueryScope: () => ({ signal: new AbortController().signal, assertCurrent: jest.fn() }),
  queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) },
}));

const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
const commandId = 'c8cf3be1-51dc-492e-85c6-4cfb634b4590';
const input: EventInput = { id, pairId, title: 'Dinner', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', temporal: { kind: 'allDay', startDate: '2026-07-01', endDateExclusive: '2026-07-02' } };
const row = { id, pair_id: pairId, created_by: '741dd351-3376-4622-a9bd-ab9ced5fac8d', title: 'Dinner', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', starts_at: null, ends_at: null, start_date: '2026-07-01', end_date_exclusive: '2026-07-02', location: null, description: null, version: 1, repeat: 'none' };
let rpc: jest.Mock;
beforeEach(() => {
  rpc = jest.fn().mockImplementation(() => ({ abortSignal: jest.fn().mockResolvedValue({ data: { ok: true, data: row }, error: null }) }));
  jest.mocked(getSupabase).mockResolvedValue({ rpc } as never);
});

it('keeps the command UUID and event UUID after an uncertain save', async () => {
  rpc.mockImplementationOnce(() => ({ abortSignal: jest.fn().mockRejectedValue(new Error('timeout')) }));
  expect((await createEvent(input, commandId)).ok).toBe(false);
  expect((await createEvent(input, commandId)).ok).toBe(true);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(rpc.mock.calls[1][1]).toMatchObject({ p_command_id: commandId, p_input: { id } });
});
it('returns a stale edit conflict and sends the original expected version', async () => {
  rpc.mockImplementation(() => ({ abortSignal: jest.fn().mockResolvedValue({ data: { ok: false, error: { code: 'CONFLICT' } }, error: null }) }));
  expect(await updateEvent(id, input, 1, commandId)).toEqual({ ok: false, error: { code: 'CONFLICT' } });
  expect(rpc.mock.calls[0][1].p_expected_version).toBe(1);
});
// Importance: 98. An edit without a version must never become a create.
it('rejects an edit when its version is missing', async () => {
  expect(await updateEvent(id, input, undefined as never, commandId)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(rpc).not.toHaveBeenCalled();
});
it('sends explicit private-to-shared consent to the server', async () => {
  await updateEvent(id, { ...input, confirmShared: true }, 2, commandId);
  expect(rpc.mock.calls[0][1].p_input.confirm_shared).toBe(true);
});
it('checks the version when deleting', async () => {
  rpc.mockImplementation(() => ({ abortSignal: jest.fn().mockResolvedValue({ data: { ok: true, data: { id } }, error: null }) }));
  expect(await deleteEvent(id, 3, commandId)).toEqual({ ok: true, data: { id } });
  expect(rpc.mock.calls[0]).toEqual(['delete_event', { p_event_id: id, p_expected_version: 3, p_command_id: commandId }]);
});

// Importance: 100. Visibility comes from authenticated backend reads.
it('keeps forbidden responses out of the agenda', async () => {
  rpc.mockImplementation(() => ({ abortSignal: jest.fn().mockResolvedValue({ data: { ok: false, error: { code: 'FORBIDDEN' } }, error: null }) }));
  await expect(listAgenda({ pairId, from: '2026-07-01', to: '2026-07-02' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
// Importance: 96. Queries must preserve overlap range and bound work.
it('passes the exclusive range to the server and limits it to 366 days', async () => {
  rpc.mockImplementation(() => ({ abortSignal: jest.fn().mockResolvedValue({ data: { ok: true, data: [row] }, error: null }) }));
  expect(await listAgenda({ pairId, from: '2026-07-01', to: '2026-08-01' })).toHaveLength(1);
  expect(rpc.mock.calls[0]).toEqual(['list_agenda', { p_pair_id: pairId, p_from: '2026-07-01', p_to: '2026-08-01' }]);
  await expect(listAgenda({ pairId, from: '2026-01-01', to: '2027-01-03' })).rejects.toMatchObject({ code: 'VALIDATION' });
  expect(rpc).toHaveBeenCalledTimes(1);
});
