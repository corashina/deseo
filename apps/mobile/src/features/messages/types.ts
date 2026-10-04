import type { Id } from '../../lib/result';

export type MessageCursor = { createdAt: string; id: Id };
export type Message = MessageCursor & {
  pairId: Id;
  authorId: Id;
  clientId: Id;
  body: string;
  pinnedAt: string | null;
  version: number;
};
export type SendMessageInput = { pairId: Id; clientId: Id; body: string };
export type PendingMessage = { clientId: Id; body: string; state: 'sending' | 'failed' };
export type MessageDraft = { body: string; pending: PendingMessage[] };
export type ReconciledMessageSends = { messages: Message[]; deletedClientIds: Id[] };
