import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';
import { AppError, resultSchema, type Page } from '../../lib/result';
import { decodeMessageCursor, encodeMessageCursor, messageIdSchema, messageRowSchema } from './schema';
import type { Message, ReconciledMessageSends } from './types';

export const MESSAGE_PAGE_SIZE = 50;
export const MESSAGE_COLUMNS = 'id,pair_id,author_id,client_id,body,created_at,pinned_at,version';
export const messageKeys = {
  all: (accountId: string, pairId: string) => ['messages', accountId, pairId] as const,
  conversation: (accountId: string, pairId: string) => [...messageKeys.all(accountId, pairId), 'conversation'] as const,
  unread: (accountId: string, pairId: string) => [...messageKeys.all(accountId, pairId), 'unread'] as const,
  notes: (accountId: string, pairId: string) => [...messageKeys.all(accountId, pairId), 'notes'] as const,
};

export async function listMessages(pairId: string, before?: string): Promise<Page<Message>> {
  const pair = messageIdSchema.parse(pairId);
  let cursor;
  try { cursor = before === undefined ? undefined : decodeMessageCursor(before); }
  catch { throw new AppError({ code: 'VALIDATION', field: 'cursor' }); }
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  let query = client.from('messages').select(MESSAGE_COLUMNS).eq('pair_id', pair)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(MESSAGE_PAGE_SIZE + 1);
  if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  const response = await query.abortSignal(scope.signal);
  scope.assertCurrent();
  if (response.error) throw response.error;
  const rows = z.array(messageRowSchema).max(MESSAGE_PAGE_SIZE + 1).parse(response.data);
  if (rows.some(row => row.pairId !== pair)) throw new AppError({ code: 'FORBIDDEN' });
  const items = rows.slice(0, MESSAGE_PAGE_SIZE);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > MESSAGE_PAGE_SIZE && last
    ? encodeMessageCursor({ createdAt: last.createdAt, id: last.id }) : null };
}

export async function getUnreadCount(pairId: string): Promise<number> {
  const pair = messageIdSchema.parse(pairId);
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  const response = await client.rpc('get_unread_count', { p_pair_id: pair }).abortSignal(scope.signal);
  scope.assertCurrent();
  if (response.error) throw response.error;
  const result = resultSchema(z.object({ count: z.number().int().nonnegative() })).parse(response.data);
  if (!result.ok) throw new AppError(result.error);
  return result.data.count;
}

export async function reconcileMessageSends(pairId: string, clientIds: readonly string[]): Promise<ReconciledMessageSends> {
  const pair = messageIdSchema.parse(pairId);
  const ids = z.array(messageIdSchema).max(100).parse(clientIds);
  if (!ids.length) return { messages: [], deletedClientIds: [] };
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  const response = await client.rpc('reconcile_message_sends', { p_pair_id: pair, p_client_ids: ids }).abortSignal(scope.signal);
  scope.assertCurrent();
  if (response.error) throw response.error;
  const result = resultSchema(z.object({ messages: z.array(messageRowSchema), deleted_client_ids: z.array(messageIdSchema) })).parse(response.data);
  if (!result.ok) throw new AppError(result.error);
  if (result.data.messages.some(row => row.pairId !== pair)) throw new AppError({ code: 'FORBIDDEN' });
  return { messages: result.data.messages, deletedClientIds: result.data.deleted_client_ids };
}
