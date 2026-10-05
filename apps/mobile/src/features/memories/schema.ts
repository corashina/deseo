import { z } from 'zod';
import { photoSchema, memoryInputSchema, uuid } from '@deseo/domain/memories';

export const localPhotoSchema = photoSchema.omit({ order: true, fullPath: true, thumbPath: true, validated: true }).extend({
  status: z.enum(['ready', 'uploading', 'failed', 'validated', 'missing']),
});
export const draftSchema = memoryInputSchema.extend({
  memoryDate: z.string().max(10),
  accountId: uuid, pairId: uuid, draftId: uuid, id: uuid, reserveCommandId: uuid, publishCommandId: uuid,
  key: z.string().regex(/^memories:(new|edit:[0-9a-f-]{36})$/),
  photos: z.array(localPhotoSchema).max(5), reserved: z.boolean(), submitted: z.boolean(),
  expectedVersion: z.number().int().positive().optional(), commandId: uuid,
  conflict: z.boolean().default(false), selectionToken: uuid.nullable().default(null),
});
