import { DateTime } from 'luxon';
import { z } from 'zod';
import type { Task, TaskList } from './types';
export const taskDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine(value => DateTime.fromISO(value, { zone: 'UTC' }).isValid, 'Enter a valid date.');
export const listNameSchema = z.string().trim().min(1, 'Enter a name.').max(40, 'Use 40 characters or less.');
export const taskInputSchema = z.object({ id: z.string().uuid(), pairId: z.string().uuid(), listId: z.string().uuid(),
  title: z.string().trim().min(1, 'Enter a title.').max(200, 'Use 200 characters or less.'), assigneeId: z.string().uuid().nullable(), dueDate: taskDateSchema.nullable() }).strict();
export const taskRowSchema = z.object({ id: z.string().uuid(), pair_id: z.string().uuid(), list_id: z.string().uuid(), title: z.string(), assignee_id: z.string().uuid().nullable(), due_date: taskDateSchema.nullable(), created_by: z.string().uuid(), completed_at: z.string().nullable(), completed_by: z.string().uuid().nullable(), version: z.number().int().positive() }).transform((row): Task => ({
  ...taskInputSchema.parse({ id: row.id, pairId: row.pair_id, listId: row.list_id, title: row.title, assigneeId: row.assignee_id, dueDate: row.due_date }),
  authorId: row.created_by, completedAt: row.completed_at, completedBy: row.completed_by, version: row.version,
}));
export const listRowSchema = z.object({ id: z.string().uuid(), pair_id: z.string().uuid(), name: listNameSchema, is_general: z.boolean(), created_by: z.string().uuid().nullable(), version: z.number().int().positive() }).transform((row): TaskList => ({ id: row.id, pairId: row.pair_id, name: row.name, isGeneral: row.is_general, authorId: row.created_by, version: row.version }));
