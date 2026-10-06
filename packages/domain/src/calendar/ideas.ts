import { z } from 'zod';

export const ideaFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(120, 'Use 120 characters or less.'),
  note: z.string().trim().max(1000, 'Use 1,000 characters or less.'),
  link: z.string().trim().max(2048, 'Use 2,048 characters or less.').refine(value => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !/\s/.test(value); } catch { return false; }
  }, 'Use an HTTPS link.'),
});
export const ideaInputSchema = ideaFieldsSchema.extend({ id: z.string().uuid(), pairId: z.string().uuid() }).strict();
export type IdeaInput = z.infer<typeof ideaInputSchema>;
export type IdeaState = 'saved' | 'planned' | 'archived';
export const ideaRowSchema = z.object({ id: z.string().uuid(), pair_id: z.string().uuid(), created_by: z.string().uuid(),
  title: z.string(), note: z.string().nullable(), link: z.string().nullable(), state: z.enum(['saved', 'planned', 'archived']),
  linked_event_id: z.string().uuid().nullable(), version: z.number().int().positive(), created_at: z.string(), updated_at: z.string(),
}).transform(row => ({ id: row.id, pairId: row.pair_id, authorId: row.created_by, title: row.title, note: row.note ?? '',
  link: row.link ?? '', state: row.state, linkedEventId: row.linked_event_id, version: row.version, createdAt: row.created_at }));
export type DateIdea = z.infer<typeof ideaRowSchema>;
