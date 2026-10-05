import { z } from 'zod';
import { messageIdSchema, messageBodySchema } from '@deseo/domain/messages';

export const pendingMessageSchema = z.object({
  clientId: messageIdSchema, body: messageBodySchema, state: z.enum(['sending', 'failed']),
}).strict();
export const messageDraftSchema = z.object({
  body: z.string().refine(value => Array.from(value).length <= 4000), pending: z.array(pendingMessageSchema),
}).strict().refine(value => new Set(value.pending.map(item => item.clientId)).size === value.pending.length);
