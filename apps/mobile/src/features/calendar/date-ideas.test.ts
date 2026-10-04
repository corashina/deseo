// Importance: 98. Planning must preserve retry IDs, source versions, and current query scope.
import { createIdea, updateIdea, archiveIdea, planDateIdea, ideaInputSchema } from './date-ideas';
import { getSupabase } from '../../lib/supabase';
import { queryClient, captureQueryScope } from '../../lib/query-client';
import type { EventInput } from './types';
jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: jest.fn(), queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) } }));
const id = '41000000-0000-4000-8000-000000000001'; const pairId = '30000000-0000-4000-8000-000000000001';
const commandId = '51000000-0000-4000-8000-000000000001';
const input = { id, pairId, title: 'Dinner', note: '', link: 'https://example.test' };
const row = { id, pair_id: pairId, created_by: id, title: input.title, note: null, link: input.link, state: 'saved', linked_event_id: null, version: 1, created_at: '2026-10-04T12:00:00Z', updated_at: '2026-10-04T12:00:00Z' };
const eventInput: EventInput = { id: '42000000-0000-4000-8000-000000000001', pairId, title: 'Dinner', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', temporal: { kind: 'allDay', startDate: '2027-01-01', endDateExclusive: '2027-01-02' } };
const eventRow = { id: eventInput.id, pair_id: pairId, created_by: id, title: 'Dinner', owner: 'together', visibility: 'shared', timezone: 'Europe/Warsaw', starts_at: null, ends_at: null, start_date: '2027-01-01', end_date_exclusive: '2027-01-02', repeat: 'none', location: null, description: null, version: 1 };
let rpc: jest.Mock; let response: jest.Mock; let assertCurrent: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks(); assertCurrent = jest.fn();
  jest.mocked(captureQueryScope).mockReturnValue({ signal: new AbortController().signal, assertCurrent });
  response = jest.fn().mockResolvedValue({ data: { ok: true, data: row }, error: null }); rpc = jest.fn(() => ({ abortSignal: response }));
  jest.mocked(getSupabase).mockResolvedValue({ rpc } as never);
});
it('rejects HTTP, missing hosts, and whitespace links before a command', async () => {
  for (const link of ['http://example.test', 'https://', 'https://example.test/a b']) expect(ideaInputSchema.safeParse({ ...input, link }).success).toBe(false);
  expect((await createIdea({ ...input, link: 'http://example.test' }, commandId)).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
it('sends one atomic plan command and retains its IDs and source version on retry', async () => {
  response.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue({ data: { ok: true, data: eventRow }, error: null });
  expect(await planDateIdea(id, eventInput, 7, commandId)).toMatchObject({ ok: false, error: { code: 'RETRYABLE' } });
  expect((await planDateIdea(id, eventInput, 7, commandId)).ok).toBe(true);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  expect(rpc.mock.calls[1]).toEqual(['plan_date_idea', expect.objectContaining({ p_idea_id: id, p_command_id: commandId, p_expected_version: 7, p_event_input: expect.objectContaining({ id: eventInput.id, pair_id: pairId, visibility: 'shared' }) })]);
});
it('rejects private idea plans and updates without an expected version', async () => {
  expect(await planDateIdea(id, { ...eventInput, visibility: 'private', owner: 'a' }, 1, commandId)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(await updateIdea(id, input, undefined as never, commandId)).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(rpc).not.toHaveBeenCalled();
});
it('returns archive conflicts without invalidating confirmed rows', async () => {
  response.mockResolvedValue({ data: { ok: false, error: { code: 'CONFLICT' } }, error: null });
  expect(await archiveIdea(id, 2, commandId)).toEqual({ ok: false, error: { code: 'CONFLICT' } });
  expect(rpc).toHaveBeenCalledWith('archive_date_idea', { p_idea_id: id, p_expected_version: 2, p_command_id: commandId });
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
});
// Importance: 100. A stale account completion must not enter the current cache.
it('rejects a successful response after query scope revocation', async () => {
  assertCurrent.mockImplementationOnce(() => undefined).mockImplementation(() => { throw new Error('revoked'); });
  expect(await createIdea(input, commandId)).toMatchObject({ ok: false, error: { code: 'RETRYABLE' } });
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
});
