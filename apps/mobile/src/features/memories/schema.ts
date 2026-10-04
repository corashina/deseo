import { z } from 'zod';
import { DateTime } from 'luxon';

export const uuid = z.string().uuid();
export const memoryInputSchema = z.object({
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => DateTime.fromISO(value).isValid, 'Enter a valid date.'),
  caption: z.string().max(1000),
});
export const photoSchema = z.object({
  id: uuid, order: z.number().int(), fullPath: z.string(), thumbPath: z.string(),
  fullBytes: z.number().int().positive().max(5242880), thumbBytes: z.number().int().positive().max(5242880),
  width: z.number().int().positive().max(2560), height: z.number().int().positive().max(2560),
  thumbWidth: z.number().int().positive().max(512), thumbHeight: z.number().int().positive().max(512), validated: z.boolean(),
});
export const memorySchema = memoryInputSchema.extend({
  id: uuid, pairId: uuid, createdBy: uuid, state: z.enum(['pending', 'published', 'deleting']),
  version: z.number().int().positive(), createdAt: z.string(), updatedAt: z.string(), expiresAt: z.string().nullable(),
  photos: z.array(photoSchema).max(5),
});
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
export const cursorSchema = z.object({ memoryDate: memoryInputSchema.shape.memoryDate, id: uuid });
