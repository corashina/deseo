// Importance: 95. Stable pages must preserve message boundaries when newer rows arrive.
import { listMessages, getUnreadCount, reconcileMessageSends, MESSAGE_COLUMNS } from './queries';
import { listPinnedNotes } from './notes';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';
import { AppError } from '../../lib/result';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => ({ captureQueryScope: jest.fn() }));
const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
const authorId = '741dd351-3376-4622-a9bd-ab9ced5fac8d';
const makeRow = (number: number) => ({
  id: `74ff3de3-609c-43c3-bbd3-${number.toString().padStart(12, '0')}`,
  pair_id: pairId, author_id: authorId, client_id: `c8cf3be1-51dc-492e-85c6-${number.toString().padStart(12, '0')}`,
  body: `Message ${number}`, created_at: '2026-10-04T10:00:00.123456+00:00', pinned_at: null, version: 1,
});
let builder: Record<string, jest.Mock>;
let from: jest.Mock;
let rpc: jest.Mock;
let assertCurrent: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  assertCurrent = jest.fn();
  jest.mocked(captureQueryScope).mockReturnValue({ signal: new AbortController().signal, assertCurrent });
  builder = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'or', 'not']) builder[method] = jest.fn(() => builder);
  builder.abortSignal = jest.fn().mockResolvedValue({ data: [], error: null });
  from = jest.fn(() => builder);
  rpc = jest.fn(() => builder);
  jest.mocked(getSupabase).mockResolvedValue({ from, rpc } as never);
});

it('returns 50 rows and keeps the exact tuple boundary while a new head arrives', async () => {
  const rows = Array.from({ length: 51 }, (_, index) => makeRow(100 - index));
  builder.abortSignal!.mockResolvedValueOnce({ data: rows, error: null });
  const first = await listMessages(pairId);
  expect(first.items).toHaveLength(50);
  expect(builder.select).toHaveBeenCalledWith(MESSAGE_COLUMNS);
  expect(builder.eq).toHaveBeenCalledWith('pair_id', pairId);
  expect(builder.order!.mock.calls).toEqual([['created_at', { ascending: false }], ['id', { ascending: false }]]);
  expect(builder.limit).toHaveBeenCalledWith(51);
  const boundary = rows[49]!;
  expect(JSON.parse(first.nextCursor!)).toEqual({ createdAt: boundary.created_at, id: boundary.id });
  builder.abortSignal!.mockResolvedValueOnce({ data: [rows[50]], error: null });
  const older = await listMessages(pairId, first.nextCursor!);
  expect(builder.or).toHaveBeenCalledWith(`created_at.lt.${boundary.created_at},and(created_at.eq.${boundary.created_at},id.lt.${boundary.id})`);
  expect(older.items[0]?.id).toBe(rows[50]!.id);
  expect(older.nextCursor).toBeNull();
});

it('rejects malformed cursors before building a filter', async () => {
  await expect(listMessages(pairId, '{bad')).rejects.toMatchObject({ code: 'VALIDATION' });
  await expect(listMessages(pairId, JSON.stringify({ createdAt: 'a,b', id: makeRow(1).id }))).rejects.toMatchObject({ code: 'VALIDATION' });
  expect(from).not.toHaveBeenCalled();
});

// Importance: 100. Late responses must not cross the current account and pair scope.
it('rejects a completed page after the scope changes', async () => {
  builder.abortSignal!.mockResolvedValueOnce({ data: [makeRow(1)], error: null });
  assertCurrent.mockImplementationOnce(() => undefined).mockImplementation(() => { throw new AppError({ code: 'UNAUTHENTICATED' }); });
  await expect(listMessages(pairId)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
});

it('reads private unread state and propagates an access denial', async () => {
  builder.abortSignal!.mockResolvedValueOnce({ data: { ok: true, data: { count: 7 } }, error: null });
  expect(await getUnreadCount(pairId)).toBe(7);
  expect(rpc).toHaveBeenCalledWith('get_unread_count', { p_pair_id: pairId });
  builder.abortSignal!.mockResolvedValueOnce({ data: { ok: false, error: { code: 'FORBIDDEN' } }, error: null });
  await expect(getUnreadCount(pairId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

it('reconciles requested send IDs against live rows and deleted IDs', async () => {
  const row = makeRow(1); const deleted = makeRow(2).client_id;
  builder.abortSignal!.mockResolvedValueOnce({ data: { ok: true, data: { messages: [row], deleted_client_ids: [deleted] } }, error: null });
  const result = await reconcileMessageSends(pairId, [row.client_id, deleted]);
  expect(result.messages[0]).toMatchObject({ id: row.id, clientId: row.client_id, authorId });
  expect(result.deletedClientIds).toEqual([deleted]);
  expect(rpc).toHaveBeenCalledWith('reconcile_message_sends', { p_pair_id: pairId, p_client_ids: [row.client_id, deleted] });
  await expect(reconcileMessageSends(pairId, Array(101).fill(row.client_id))).rejects.toThrow();
  expect(rpc).toHaveBeenCalledTimes(1);
});

it('loads at most two pins in newest-pin order', async () => {
  const row = { ...makeRow(1), pinned_at: '2026-10-04T12:00:00.123456Z' };
  builder.abortSignal!.mockResolvedValueOnce({ data: [row], error: null });
  expect((await listPinnedNotes(pairId))[0]?.pinnedAt).toBe(row.pinned_at);
  expect(builder.not).toHaveBeenCalledWith('pinned_at', 'is', null);
  expect(builder.order!.mock.calls).toEqual([['pinned_at', { ascending: false }], ['id', { ascending: false }]]);
  expect(builder.limit).toHaveBeenCalledWith(2);
});
