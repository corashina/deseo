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
export const cursorSchema = z.object({ memoryDate: memoryInputSchema.shape.memoryDate, id: uuid });
