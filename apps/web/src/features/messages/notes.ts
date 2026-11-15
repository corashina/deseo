import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { AppError } from '@deseo/domain/result';
import { MESSAGE_COLUMNS } from './queries';
import { messageIdSchema, messageRowSchema } from '@deseo/domain/messages';
import type { Message } from '@deseo/domain/messages';

export async function listPinnedNotes(pairId: string): Promise<Message[]> {
  const pair = messageIdSchema.parse(pairId);
  const client = await getSupabase();
  const response = await client.from('messages').select(MESSAGE_COLUMNS).eq('pair_id', pair)
    .not('pinned_at', 'is', null).order('pinned_at', { ascending: false }).order('id', { ascending: false })
    .limit(2);
  if (response.error) throw response.error;
  const messages = z.array(messageRowSchema).max(2).parse(response.data);
  if (messages.some(message => message.pairId !== pair)) throw new AppError({ code: 'FORBIDDEN' });
  return messages;
}
