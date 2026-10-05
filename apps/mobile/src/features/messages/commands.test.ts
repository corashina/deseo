// Importance: 100. Retries and stale sessions must not duplicate sends or expose old content.
import { sendMessage, deleteMessage, setReadCursor } from './commands';
import { pinMessage, unpinMessage } from './notes';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { AppError } from '@deseo/domain/result';
import { messageKeys } from './queries';
import type { InfiniteData } from '@tanstack/react-query';
import type { Page } from '@deseo/domain/result';
import type { Message } from '@deseo/domain/messages';

jest.mock('../../lib/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../lib/query-client', () => {
  const { QueryClient } = jest.requireActual('@tanstack/react-query');
  const client = new QueryClient();
  client.invalidateQueries = jest.fn().mockResolvedValue(undefined);
  return { captureQueryScope: jest.fn(), queryClient: client };
});
const id = '74ff3de3-609c-43c3-bbd3-01e064593ba9';
const pairId = '610bc9c7-8c81-47d1-894e-314c92071cf1';
const clientId = 'c8cf3be1-51dc-492e-85c6-4cfb634b4590';
const authorId = '741dd351-3376-4622-a9bd-ab9ced5fac8d';
const createdAt = '2026-10-04T10:00:00.123456+00:00';
const row = { id, pair_id: pairId, author_id: authorId, client_id: clientId, body: '  Hello\nthere  ',
  created_at: createdAt, pinned_at: null, version: 1 };
let rpc: jest.Mock;
let abortSignal: jest.Mock;
let assertCurrent: jest.Mock;
let signal: AbortSignal;
beforeEach(() => {
  jest.clearAllMocks();
  queryClient.clear();
  jest.mocked(queryClient.invalidateQueries).mockResolvedValue(undefined);
  signal = new AbortController().signal;
  assertCurrent = jest.fn();
  jest.mocked(captureQueryScope).mockReturnValue({ signal, assertCurrent });
  abortSignal = jest.fn().mockResolvedValue({ data: { ok: true, data: row }, error: null });
  rpc = jest.fn(() => ({ abortSignal }));
  jest.mocked(getSupabase).mockResolvedValue({ rpc } as never);
});
afterEach(() => queryClient.clear());

it('keeps an acknowledged send visible when its following refresh fails', async () => {
  const key = messageKeys.conversation(authorId, pairId);
  const otherKey = messageKeys.conversation(clientId, pairId);
  const older: Message = { id: authorId, pairId, authorId, clientId: authorId, body: 'Older',
    createdAt: '2026-10-04T09:00:00Z', pinnedAt: null, version: 1 };
  const cached: InfiniteData<Page<Message>> = { pages: [
    { items: [older], nextCursor: 'old-boundary' }, { items: [], nextCursor: null },
  ], pageParams: [undefined, 'old-boundary'] };
  queryClient.setQueryData(key, cached);
  queryClient.setQueryData(otherKey, cached);
  jest.mocked(queryClient.invalidateQueries).mockRejectedValueOnce(new Error('read failed'));

  expect(await sendMessage({ pairId, clientId, body: row.body })).toMatchObject({ ok: true, data: { id } });
  const saved = queryClient.getQueryData<InfiniteData<Page<Message>>>(key)!;
  expect(saved.pages[0]!.items.map(message => message.id)).toEqual([id, older.id]);
  expect(saved.pages[0]!.nextCursor).toBe('old-boundary');
  expect(saved.pages[1]).toEqual(cached.pages[1]);
  expect(saved.pageParams).toEqual(cached.pageParams);
  expect(queryClient.getQueryData(otherKey)).toEqual(cached);
});

it('deduplicates an acknowledged send and preserves a newer cached version', async () => {
  const key = messageKeys.conversation(authorId, pairId);
  const existing: Message = { id, pairId, authorId, clientId, body: row.body, createdAt,
    pinnedAt: '2026-10-04T11:00:00Z', version: 3 };
  const partner: Message = { ...existing, id: '84ff3de3-609c-43c3-bbd3-01e064593ba9', authorId: pairId };
  queryClient.setQueryData<InfiniteData<Page<Message>>>(key, { pages: [
    { items: [existing, partner], nextCursor: 'boundary' },
    { items: [{ ...existing, version: 2, pinnedAt: null }, { ...existing, id: clientId, version: 2 }], nextCursor: null },
  ], pageParams: [undefined, 'boundary'] });
  expect((await sendMessage({ pairId, clientId, body: row.body })).ok).toBe(true);
  const items = queryClient.getQueryData<InfiniteData<Page<Message>>>(key)!.pages.flatMap(page => page.items);
  expect(items).toEqual([partner, existing]);
});

it('reuses the same client UUID and exact body after a lost response', async () => {
  abortSignal.mockRejectedValueOnce(new Error('timeout'));
  const input = { pairId, clientId, body: row.body };
  expect(await sendMessage(input)).toMatchObject({ ok: false, error: { code: 'RETRYABLE' } });
  expect(await sendMessage(input)).toEqual({ ok: true, data: {
    id, pairId, authorId, clientId, body: row.body, createdAt, pinnedAt: null, version: 1,
  } });
  expect(rpc.mock.calls).toEqual([
    ['send_message', { p_pair_id: pairId, p_client_id: clientId, p_body: row.body }],
    ['send_message', { p_pair_id: pairId, p_client_id: clientId, p_body: row.body }],
  ]);
  expect(abortSignal).toHaveBeenCalledWith(signal);
});

it('rejects invalid IDs and empty messages before transport', async () => {
  expect(await sendMessage({ pairId, clientId: 'invalid', body: 'Hello' })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(await sendMessage({ pairId, clientId, body: ' \n ' })).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
  expect(rpc).not.toHaveBeenCalled();
});

it('keeps a response from a canceled account scope out of the cache', async () => {
  assertCurrent.mockImplementationOnce(() => undefined).mockImplementation(() => { throw new AppError({ code: 'UNAUTHENTICATED' }); });
  expect(await sendMessage({ pairId, clientId, body: row.body })).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
});

it('returns a deleted retry or payload conflict without claiming success', async () => {
  for (const code of ['FORBIDDEN', 'CONFLICT']) {
    abortSignal.mockResolvedValueOnce({ data: { ok: false, error: { code } }, error: null });
    expect(await sendMessage({ pairId, clientId, body: row.body })).toEqual({ ok: false, error: { code } });
  }
  expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
});

it('keeps pin, unpin, and deletion command IDs and invalidates Today', async () => {
  abortSignal.mockResolvedValue({ data: { ok: true, data: { id } }, error: null });
  jest.mocked(queryClient.invalidateQueries).mockRejectedValueOnce(new Error('read failed'));
  for (const command of [pinMessage, unpinMessage, deleteMessage]) {
    expect(await command(id, clientId)).toEqual({ ok: true, data: { id } });
  }
  expect(rpc.mock.calls).toEqual(['pin_message', 'unpin_message', 'delete_message'].map(name => [name, { p_message_id: id, p_command_id: clientId }]));
  const predicate = jest.mocked(queryClient.invalidateQueries).mock.calls[0]![0]!.predicate!;
  expect(predicate({ queryKey: ['today', authorId, pairId, '2026-10-04'] } as never)).toBe(true);
  expect(predicate({ queryKey: ['messages', authorId, pairId, 'notes'] } as never)).toBe(true);
  expect(predicate({ queryKey: ['calendar', authorId, pairId] } as never)).toBe(false);
});

it('preserves microseconds and refreshes unread state without reloading the conversation', async () => {
  abortSignal.mockResolvedValue({ data: { ok: true, data: { created_at: createdAt, id } }, error: null });
  expect(await setReadCursor(pairId, { createdAt, id })).toEqual({ ok: true, data: { createdAt, id } });
  expect(rpc).toHaveBeenCalledWith('set_read_cursor', { p_pair_id: pairId, p_created_at: createdAt, p_message_id: id });
  const predicate = jest.mocked(queryClient.invalidateQueries).mock.calls[0]![0]!.predicate!;
  expect(predicate({ queryKey: ['messages', authorId, pairId, 'unread'] } as never)).toBe(true);
  expect(predicate({ queryKey: ['messages', authorId, pairId, 'conversation'] } as never)).toBe(false);
  expect(predicate({ queryKey: ['messages', authorId, id, 'unread'] } as never)).toBe(false);
});
