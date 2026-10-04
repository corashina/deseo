import { z } from 'zod';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';

const listDraftSchema = z.object({
  name: z.string(), expectedVersion: z.number().int().positive().optional(),
  conflict: z.boolean().optional(), preservedName: z.string().optional(),
});
export type ListDraft = z.infer<typeof listDraftSchema>;
export async function readListDraft(accountId: string, pairId: string, key: string): Promise<ListDraft | null> {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  const raw = await storage.getDraft(accountId, pairId, key); scope.assertCurrent();
  return raw === null ? null : listDraftSchema.parse(JSON.parse(raw));
}
export async function writeListDraft(accountId: string, pairId: string, key: string, draft: ListDraft): Promise<void> {
  const parsed = listDraftSchema.parse(draft);
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  await storage.setDraft(accountId, pairId, key, JSON.stringify(parsed)); scope.assertCurrent();
}
