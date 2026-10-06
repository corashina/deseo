import { z } from 'zod';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';

const archiveSchema = z.object({ id: z.string().uuid(), commandId: z.string().uuid(), expectedVersion: z.number().int().positive() });
export type ArchiveIntent = z.infer<typeof archiveSchema>;
export async function readArchiveIntent(accountId: string, pairId: string, key: string): Promise<ArchiveIntent | null> {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  const raw = await storage.getDraft(accountId, pairId, key); scope.assertCurrent(); return raw === null ? null : archiveSchema.parse(JSON.parse(raw));
}
export async function writeArchiveIntent(accountId: string, pairId: string, key: string, input: ArchiveIntent): Promise<void> {
  const value = JSON.stringify(archiveSchema.parse(input));
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  await storage.setDraft(accountId, pairId, key, value); scope.assertCurrent();
}
export async function removeArchiveIntent(accountId: string, pairId: string, key: string): Promise<void> {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  await storage.removeDraft(accountId, pairId, key); scope.assertCurrent();
}
