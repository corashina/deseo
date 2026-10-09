import { z } from 'zod';
import { eventRowSchema } from '../calendar';
import { taskRowSchema } from '../tasks';
import { messageRowSchema } from '../messages';
import { resultSchema } from '../result';

export const todaySummarySchema = z.object({
  agenda: z.array(eventRowSchema),
  important_dates: z.array(eventRowSchema),
  due_tasks: z.array(taskRowSchema).max(3),
  notes: z.array(messageRowSchema).max(2),
}).transform(({ agenda, important_dates, due_tasks, notes }) => ({
  agenda, importantDates: important_dates, dueTasks: due_tasks, notes,
}));
export const todayResultSchema = resultSchema(todaySummarySchema);
export type TodaySummary = z.infer<typeof todaySummarySchema>;
