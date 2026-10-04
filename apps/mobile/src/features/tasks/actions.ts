import { z } from 'zod';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';
const uuid = z.string().uuid();
const version = z.number().int().positive();
const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('complete'), id: uuid, commandId: uuid, expectedVersion: version, completed: z.boolean() }),
  z.object({ kind: z.literal('deleteTask'), id: uuid, commandId: uuid, expectedVersion: version }),
  z.object({ kind: z.literal('createList'), commandId: uuid, name: z.string() }),
  z.object({ kind: z.literal('renameList'), id: uuid, commandId: uuid, name: z.string(), expectedVersion: version }),
  z.object({ kind: z.literal('moveList'), id: uuid, commandId: uuid }),
  z.object({ kind: z.literal('deleteList'), id: uuid, commandId: uuid }),
]);
export type TaskAction = z.infer<typeof actionSchema>;
export async function readTaskAction(accountId: string, pairId: string, key: string): Promise<TaskAction | null> {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  const raw = await storage.getDraft(accountId, pairId, key); scope.assertCurrent(); return raw === null ? null : actionSchema.parse(JSON.parse(raw));
}
export async function writeTaskAction(accountId: string, pairId: string, key: string, action: TaskAction): Promise<void> {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent();
  await storage.setDraft(accountId, pairId, key, JSON.stringify(actionSchema.parse(action))); scope.assertCurrent();
}
export async function removeTaskAction(accountId: string, pairId: string, key: string): Promise<void> {
  const scope = captureQueryScope(); const storage = await getPrivateStorage(); scope.assertCurrent(); await storage.removeDraft(accountId, pairId, key); scope.assertCurrent();
}
