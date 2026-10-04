import { z } from 'zod';
import type { Message, MessageCursor } from './types';

export const messageIdSchema = z.string().uuid().transform(value => value.toLowerCase());
export const messageInstantSchema = z.string().datetime({ offset: true }).refine(value =>
  Number.isFinite(Date.parse(value)) && !/\.\d{7}/.test(value));
export const messageBodySchema = z.string().min(1).refine(value =>
  value.trim().length > 0 && Array.from(value).length <= 4000);
export const messageCursorSchema = z.object({ createdAt: messageInstantSchema, id: messageIdSchema }).strict();
export const sendMessageSchema = z.object({ pairId: messageIdSchema, clientId: messageIdSchema, body: messageBodySchema }).strict();
export const messageRowSchema = z.object({
  id: messageIdSchema,
  pair_id: messageIdSchema,
  author_id: messageIdSchema,
  client_id: messageIdSchema,
  body: messageBodySchema,
  created_at: messageInstantSchema,
  pinned_at: messageInstantSchema.nullable(),
  version: z.number().int().positive(),
}).transform((row): Message => ({
  id: row.id, pairId: row.pair_id, authorId: row.author_id, clientId: row.client_id,
  body: row.body, createdAt: row.created_at, pinnedAt: row.pinned_at, version: row.version,
}));
export const readCursorRowSchema = z.object({ created_at: messageInstantSchema, id: messageIdSchema })
  .transform((row): MessageCursor => ({ createdAt: row.created_at, id: row.id }));
export const pendingMessageSchema = z.object({
  clientId: messageIdSchema, body: messageBodySchema, state: z.enum(['sending', 'failed']),
}).strict();
export const messageDraftSchema = z.object({
  body: z.string().refine(value => Array.from(value).length <= 4000), pending: z.array(pendingMessageSchema),
}).strict().refine(value => new Set(value.pending.map(item => item.clientId)).size === value.pending.length);

export function encodeMessageCursor(cursor: MessageCursor): string {
  return JSON.stringify(messageCursorSchema.parse(cursor));
}
export function decodeMessageCursor(value: string): MessageCursor {
  return messageCursorSchema.parse(JSON.parse(value));
}
