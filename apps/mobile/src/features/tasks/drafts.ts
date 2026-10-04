import { z } from 'zod';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';
import { taskInputSchema } from './schema';
const draftValuesSchema = z.object({ title: z.string(), listId: z.string().uuid(), assigneeId: z.string().uuid().nullable(), dueDate: z.string() });
export const taskDraftSchema = z.object({ id: z.string().uuid(), commandId: z.string().uuid(), expectedVersion: z.number().int().positive().optional(),
  values: draftValuesSchema, submission: taskInputSchema.optional(), preservedValues: draftValuesSchema.optional() });
export type TaskDraft = z.infer<typeof taskDraftSchema>;
export async function readTaskDraft(accountId: string, pairId: string, key: string): Promise<TaskDraft | null> {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent(); const raw = await storage.getDraft(accountId, pairId, key); scope.assertCurrent();
  const draft = raw === null ? null : taskDraftSchema.parse(JSON.parse(raw));
  if (draft?.submission && (draft.submission.id !== draft.id || draft.submission.pairId !== pairId)) throw new Error('The draft scope changed.');
  return draft;
}
export async function writeTaskDraft(accountId: string, pairId: string, key: string, draft: TaskDraft): Promise<void> {
  const parsed = taskDraftSchema.parse(draft);
  if (parsed.submission && (parsed.submission.id !== parsed.id || parsed.submission.pairId !== pairId)) throw new Error('The draft scope changed.');
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent(); await storage.setDraft(accountId, pairId, key, JSON.stringify(parsed)); scope.assertCurrent();
}
export async function removeTaskDraft(accountId: string, pairId: string, key: string): Promise<void> {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent(); await storage.removeDraft(accountId, pairId, key); scope.assertCurrent();
}
