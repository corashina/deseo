import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';
import { messageDraftSchema, messageIdSchema } from './schema';
import type { MessageDraft } from './types';

const DRAFT_KEY = 'messages';

export async function loadMessageDraft(accountId: string, pairId: string): Promise<MessageDraft> {
  const account = messageIdSchema.parse(accountId);
  const pair = messageIdSchema.parse(pairId);
  const scope = captureQueryScope();
  const storage = await getPrivateStorage();
  scope.assertCurrent();
  const raw = await storage.getDraft(account, pair, DRAFT_KEY);
  scope.assertCurrent();
  if (raw === null) return { body: '', pending: [] };
  const draft = messageDraftSchema.parse(JSON.parse(raw));
  return { ...draft, pending: draft.pending.map(message => ({ ...message, state: 'failed' })) };
}

export async function saveMessageDraft(accountId: string, pairId: string, draft: MessageDraft): Promise<void> {
  const account = messageIdSchema.parse(accountId);
  const pair = messageIdSchema.parse(pairId);
  const parsed = messageDraftSchema.parse(draft);
  const scope = captureQueryScope();
  const storage = await getPrivateStorage();
  scope.assertCurrent();
  if (!parsed.body && !parsed.pending.length) await storage.removeDraft(account, pair, DRAFT_KEY);
  else await storage.setDraft(account, pair, DRAFT_KEY, JSON.stringify(parsed));
  scope.assertCurrent();
}
