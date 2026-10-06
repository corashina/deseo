import { z } from 'zod';
import { getPrivateStorage } from '../../lib/private-storage';
import { captureQueryScope } from '../../lib/query-client';
import { eventInputSchema } from '@deseo/domain/calendar';

export const eventDraftValuesSchema = z.object({ title: z.string(), allDay: z.boolean(), repeat: z.enum(['none', 'yearly']).optional(), importantDate: z.boolean().optional(), startDate: z.string(), endDate: z.string(),
    startTime: z.string(), endTime: z.string(), startOffset: z.number().optional(), endOffset: z.number().optional(),
    timezone: z.string(), owner: z.enum(['a', 'b', 'together']), visibility: z.enum(['shared', 'private']),
    location: z.string(), description: z.string() });
const draftSchema = z.object({
  id: z.string().uuid(), commandId: z.string().uuid(), expectedVersion: z.number().int().positive().optional(),
  values: eventDraftValuesSchema,
  preservedValues: eventDraftValuesSchema.optional(),
  sourceIdea: z.object({ id: z.string().uuid(), version: z.number().int().positive() }).optional(),
  submission: eventInputSchema.optional(),
});
export type EventDraft = z.infer<typeof draftSchema>;

function assertDraftScope(pairId: string, key: string, draft: EventDraft) {
  if (draft.submission && (draft.submission.pairId !== pairId || draft.submission.id !== draft.id)) throw new Error('The draft scope changed.');
  if (draft.sourceIdea && key !== `calendar:idea-plan:${draft.sourceIdea.id}`) throw new Error('The idea draft scope changed.');
  if (key.startsWith('calendar:idea-plan:') && !draft.sourceIdea) throw new Error('The idea draft has no source.');
  if (draft.sourceIdea && draft.submission && (draft.submission.visibility !== 'shared' || draft.submission.repeat === 'yearly')) throw new Error('The planned event changed.');
}

export async function readEventDraft(accountId: string, pairId: string, key: string): Promise<EventDraft | null> {
  const scope = captureQueryScope();
  const storage = await getPrivateStorage();
  scope.assertCurrent();
  const raw = await storage.getDraft(accountId, pairId, key);
  scope.assertCurrent();
  const draft = raw === null ? null : draftSchema.parse(JSON.parse(raw));
  if (draft) assertDraftScope(pairId, key, draft);
  return draft;
}
export async function writeEventDraft(accountId: string, pairId: string, key: string, draft: EventDraft): Promise<void> {
  const scope = captureQueryScope();
  const parsed = draftSchema.parse(draft);
  assertDraftScope(pairId, key, parsed);
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
