import { z } from 'zod';
import { callRpc } from '../../lib/rpc';
import { invalidate } from '../../lib/query-keys';
import { messageKeys } from './queries';
import type { RpcName } from '../../lib/supabase';
import { messageCursorSchema, messageIdSchema, messageRowSchema, readCursorRowSchema, sendMessageSchema } from '@deseo/domain/messages';
import type { Message, MessageCursor, SendMessageInput } from '@deseo/domain/messages';

async function messageCommand<T extends z.ZodTypeAny>(name: RpcName, parameters: Record<string, unknown>, schema: T): Promise<z.infer<T>> {
  const data = await callRpc(name, parameters, schema);
  await invalidate(['messages'], ['today']);
  return data;
}
// A retry sends the same client ID, so the server stores the message once.
export function sendMessage(input: SendMessageInput): Promise<Message> {
  const parsed = sendMessageSchema.parse(input);
  return messageCommand('send_message', { p_pair_id: parsed.pairId, p_client_id: parsed.clientId, p_body: parsed.body }, messageRowSchema);
}
// These RPCs take a command ID. Each attempt sends a new one.
const messageAction = (name: RpcName) => (id: string) =>
  messageCommand(name, { p_message_id: messageIdSchema.parse(id), p_command_id: crypto.randomUUID() }, z.object({ id: messageIdSchema }));
export const deleteMessage = messageAction('delete_message');
export const pinMessage = messageAction('pin_message');
export const unpinMessage = messageAction('unpin_message');
export async function setReadCursor(accountId: string, pairId: string, cursor: MessageCursor): Promise<MessageCursor> {
  const parsed = messageCursorSchema.parse(cursor);
  const data = await callRpc('set_read_cursor', { p_pair_id: messageIdSchema.parse(pairId), p_created_at: parsed.createdAt, p_message_id: parsed.id }, readCursorRowSchema);
  await invalidate(messageKeys.unread(accountId, pairId));
  return data;
}
