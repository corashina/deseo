import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';
import { AppError, errorResult, type Result } from '@deseo/domain/result';
import { runMessageCommand } from './commands';
import { MESSAGE_COLUMNS } from './queries';
import { messageIdSchema, messageRowSchema } from '@deseo/domain/messages';
import type { Message } from '@deseo/domain/messages';

async function setPin(name: 'pin_message' | 'unpin_message', id: string, commandId: string): Promise<Result<{ id: string }>> {
  try {
    return await runMessageCommand(name, {
      p_message_id: messageIdSchema.parse(id), p_command_id: messageIdSchema.parse(commandId),
    }, z.object({ id: messageIdSchema }), { today: true });
  } catch (error) { return errorResult(error); }
}
export function pinMessage(id: string, commandId: string): Promise<Result<{ id: string }>> {
  return setPin('pin_message', id, commandId);
}
export function unpinMessage(id: string, commandId: string): Promise<Result<{ id: string }>> {
  return setPin('unpin_message', id, commandId);
}
export async function listPinnedNotes(pairId: string): Promise<Message[]> {
  const pair = messageIdSchema.parse(pairId);
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  const response = await client.from('messages').select(MESSAGE_COLUMNS).eq('pair_id', pair)
    .not('pinned_at', 'is', null).order('pinned_at', { ascending: false }).order('id', { ascending: false })
    .limit(2).abortSignal(scope.signal);
  scope.assertCurrent();
  if (response.error) throw response.error;
  const messages = z.array(messageRowSchema).max(2).parse(response.data);
  if (messages.some(message => message.pairId !== pair)) throw new AppError({ code: 'FORBIDDEN' });
  return messages;
}
