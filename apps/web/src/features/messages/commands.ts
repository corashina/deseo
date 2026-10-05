import { z } from 'zod';
import type { InfiniteData } from '@tanstack/react-query';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope, queryClient } from '../../lib/query-client';
import { errorResult, resultSchema, type Page, type Result } from '@deseo/domain/result';
import { encodeMessageCursor, messageCursorSchema, messageIdSchema, messageRowSchema, readCursorRowSchema, sendMessageSchema } from '@deseo/domain/messages';
import { compareMessageCursors, messageKeys } from './queries';
import { assertOnline } from '../../lib/network';
import type { Message, MessageCursor, SendMessageInput } from '@deseo/domain/messages';

export async function runMessageCommand<T extends z.ZodTypeAny>(
  name: string, parameters: Record<string, unknown>, schema: T,
  invalidation: { pairId?: string; today?: boolean; unreadOnly?: boolean } = {},
): Promise<Result<z.infer<T>>> {
  try {
    assertOnline();
    const scope = captureQueryScope();
    const client = await getSupabase();
    scope.assertCurrent();
    const response = await client.rpc(name, parameters).abortSignal(scope.signal);
    scope.assertCurrent();
    if (response.error) return errorResult(response.error);
    const result = resultSchema(schema).parse(response.data);
    if (result.ok) {
      try {
        await queryClient.invalidateQueries({ predicate: query => {
          const key = query.queryKey;
          if (invalidation.pairId !== undefined && key[2] !== invalidation.pairId) return false;
          return key[0] === 'messages' && (!invalidation.unreadOnly || key[3] === 'unread')
            || invalidation.today === true && key[0] === 'today';
        } });
      } catch { /* A failed read does not undo the confirmed command. */ }
      scope.assertCurrent();
    }
    return result;
  } catch (error) { return errorResult(error); }
}

export async function sendMessage(input: SendMessageInput): Promise<Result<Message>> {
  try {
    assertOnline();
    const parsed = sendMessageSchema.parse(input);
    const scope = captureQueryScope();
    const client = await getSupabase();
    scope.assertCurrent();
    const response = await client.rpc('send_message', {
      p_pair_id: parsed.pairId, p_client_id: parsed.clientId, p_body: parsed.body,
    }).abortSignal(scope.signal);
    scope.assertCurrent();
    if (response.error) return errorResult(response.error);
    const result = resultSchema(messageRowSchema).parse(response.data);
    if (result.ok) {
      scope.assertCurrent();
      const confirmed = result.data;
      queryClient.setQueryData<InfiniteData<Page<Message>>>(messageKeys.conversation(confirmed.authorId, confirmed.pairId), cached => {
        scope.assertCurrent();
        if (!cached?.pages.length) return { pages: [{ items: [confirmed], nextCursor:
          encodeMessageCursor({ createdAt: confirmed.createdAt, id: confirmed.id }) }], pageParams: [undefined] };
        let latest = confirmed;
        let target = -1;
        const matches = (message: Message) => message.id === confirmed.id
          || message.authorId === confirmed.authorId && message.clientId === confirmed.clientId;
        cached.pages.forEach((page, index) => {
          for (const message of page.items) {
            if (!matches(message)) continue;
            if (target < 0) target = index;
            if (message.version > latest.version) latest = message;
          }
        });
        if (target < 0) target = 0;
        return { ...cached, pages: cached.pages.map((page, index) => {
          const items = page.items.filter(message => !matches(message));
          if (index === target) { items.push(latest); items.sort((left, right) => compareMessageCursors(right, left)); }
          return { ...page, items };
        }) };
      });
      scope.assertCurrent();
      try {
        await queryClient.invalidateQueries({ predicate: query =>
          query.queryKey[0] === 'messages' && query.queryKey[2] === parsed.pairId });
      } catch { /* Keep the acknowledged message until a durable refresh succeeds. */ }
      scope.assertCurrent();
    }
    return result;
  } catch (error) { return errorResult(error); }
}

export async function deleteMessage(id: string, commandId: string): Promise<Result<{ id: string }>> {
  try {
    return await runMessageCommand('delete_message', {
      p_message_id: messageIdSchema.parse(id), p_command_id: messageIdSchema.parse(commandId),
    }, z.object({ id: messageIdSchema }), { today: true });
  } catch (error) { return errorResult(error); }
}

export async function setReadCursor(pairId: string, cursor: MessageCursor): Promise<Result<MessageCursor>> {
  try {
    const pair = messageIdSchema.parse(pairId);
    const parsed = messageCursorSchema.parse(cursor);
    return await runMessageCommand('set_read_cursor', {
      p_pair_id: pair, p_created_at: parsed.createdAt, p_message_id: parsed.id,
    }, readCursorRowSchema, { pairId: pair, unreadOnly: true });
  } catch (error) { return errorResult(error); }
}
