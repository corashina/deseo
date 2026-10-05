import type { Id } from '@deseo/domain/result';

export type PendingMessage = { clientId: Id; body: string; state: 'sending' | 'failed' };
export type MessageDraft = { body: string; pending: PendingMessage[] };
