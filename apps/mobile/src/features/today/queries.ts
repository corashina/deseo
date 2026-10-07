import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';
import { AppError, resultSchema } from '@deseo/domain/result';
import { eventRowSchema } from '@deseo/domain/calendar';
import { taskRowSchema } from '@deseo/domain/tasks';
import { messageRowSchema } from '@deseo/domain/messages';
import type { TodayView } from './types';

const todaySchema = z.object({
  agenda: z.array(eventRowSchema), important_dates: z.array(eventRowSchema),
  due_tasks: z.array(taskRowSchema).max(3), notes: z.array(messageRowSchema).max(2),
});

// One request returns the agenda, important dates, due tasks, and notes. The server checks current membership.
export async function getToday(pairId: string, date: string): Promise<TodayView> {
  const pair = z.string().uuid().parse(pairId);
  if (!z.string().date().safeParse(date).success) throw new AppError({ code: 'VALIDATION', field: 'date' });
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  const response = await client.rpc('get_today', { p_pair_id: pair, p_date: date }).abortSignal(scope.signal);
  scope.assertCurrent();
  if (response.error) throw response.error;
  const result = resultSchema(todaySchema).parse(response.data);
  if (!result.ok) throw new AppError(result.error);
  const { agenda, important_dates: importantDates, due_tasks: dueTasks, notes } = result.data;
  if ([...agenda, ...importantDates, ...dueTasks, ...notes].some(row => row.pairId !== pair)) throw new AppError({ code: 'FORBIDDEN' });
  const now = Date.now();
  return { agenda: agenda.filter(event => event.temporal.kind === 'allDay' || Date.parse(event.temporal.endsAt) > now),
    importantDates, dueTasks, notes };
}
