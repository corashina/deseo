import { z } from 'zod';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';
import { ideaInputSchema } from './date-ideas';
const values = z.object({ title: z.string(), note: z.string(), link: z.string() });
export const ideaDraftSchema = z.object({ id: z.string().uuid(), commandId: z.string().uuid(), expectedVersion: z.number().int().positive().optional(),
  values, submission: ideaInputSchema.optional(), preservedValues: values.optional() });
export type IdeaDraft = z.infer<typeof ideaDraftSchema>;
const archiveSchema = z.object({ id: z.string().uuid(), commandId: z.string().uuid(), expectedVersion: z.number().int().positive() });
export type ArchiveIntent = z.infer<typeof archiveSchema>;
async function read<T extends z.ZodTypeAny>(accountId: string, pairId: string, key: string, schema: T): Promise<z.infer<T> | null> {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  const raw = await storage.getDraft(accountId, pairId, key); scope.assertCurrent(); return raw === null ? null : schema.parse(JSON.parse(raw));
}
async function write(accountId: string, pairId: string, key: string, value: unknown) {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  await storage.setDraft(accountId, pairId, key, JSON.stringify(value)); scope.assertCurrent();
}
export async function readIdeaDraft(accountId: string, pairId: string, key: string) {
  const draft = await read(accountId, pairId, key, ideaDraftSchema);
  if (draft?.submission && (draft.submission.id !== draft.id || draft.submission.pairId !== pairId)) throw new Error('The draft scope changed.');
  return draft;
}
export async function writeIdeaDraft(accountId: string, pairId: string, key: string, input: IdeaDraft) {
  const draft = ideaDraftSchema.parse(input);
  if (draft.submission && (draft.submission.id !== draft.id || draft.submission.pairId !== pairId)) throw new Error('The draft scope changed.');
  await write(accountId, pairId, key, draft);
}
export function readArchiveIntent(accountId: string, pairId: string, key: string) { return read(accountId, pairId, key, archiveSchema); }
export function writeArchiveIntent(accountId: string, pairId: string, key: string, input: ArchiveIntent) { return write(accountId, pairId, key, archiveSchema.parse(input)); }
export async function removeIdeaDraft(accountId: string, pairId: string, key: string) {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  await storage.removeDraft(accountId, pairId, key); scope.assertCurrent();
}
