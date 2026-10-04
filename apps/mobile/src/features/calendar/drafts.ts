import { z } from 'zod';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';
import { eventInputSchema } from './schema';

const draftSchema = z.object({
  id: z.string().uuid(), commandId: z.string().uuid(), expectedVersion: z.number().int().positive().optional(),
  values: z.object({ title: z.string(), allDay: z.boolean(), startDate: z.string(), endDate: z.string(),
    startTime: z.string(), endTime: z.string(), startOffset: z.number().optional(), endOffset: z.number().optional(),
    timezone: z.string(), owner: z.enum(['a', 'b', 'together']), visibility: z.enum(['shared', 'private']),
    location: z.string(), description: z.string() }),
  submission: eventInputSchema.optional(),
});
export type EventDraft = z.infer<typeof draftSchema>;

export async function readEventDraft(accountId: string, pairId: string, key: string): Promise<EventDraft | null> {
  const scope = captureQueryScope();
  const storage = await getPrivateStorage();
  scope.assertCurrent();
  const raw = await storage.getDraft(accountId, pairId, key);
  scope.assertCurrent();
  return raw === null ? null : draftSchema.parse(JSON.parse(raw));
}
export async function writeEventDraft(accountId: string, pairId: string, key: string, draft: EventDraft): Promise<void> {
  const scope = captureQueryScope();
  const parsed = draftSchema.parse(draft);
  if (parsed.submission && (parsed.submission.pairId !== pairId || parsed.submission.id !== parsed.id)) throw new Error('The draft scope changed.');
  const storage = await getPrivateStorage();
  scope.assertCurrent();
  await storage.setDraft(accountId, pairId, key, JSON.stringify(parsed));
  scope.assertCurrent();
}
export async function removeEventDraft(accountId: string, pairId: string, key: string): Promise<void> {
  const scope = captureQueryScope();
  const storage = await getPrivateStorage();
  scope.assertCurrent();
  await storage.removeDraft(accountId, pairId, key);
  scope.assertCurrent();
}
