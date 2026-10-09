import { z } from 'zod';
import { getSupabase } from '../../lib/supabase';
import { captureQueryScope } from '../../lib/query-client';
import { AppError } from '@deseo/domain/result';
import { dateSchema } from '@deseo/domain/calendar';
import { todayResultSchema, type TodaySummary } from '@deseo/domain/today';

// The server checks current membership for this summary.
export async function getToday(pairId: string, date: string): Promise<TodaySummary> {
  const pair = z.string().uuid().parse(pairId);
  if (!dateSchema.safeParse(date).success) throw new AppError({ code: 'VALIDATION', field: 'date' });
  const scope = captureQueryScope();
  const client = await getSupabase();
  scope.assertCurrent();
  const response = await client.rpc('get_today', { p_pair_id: pair, p_date: date }).abortSignal(scope.signal);
  scope.assertCurrent();
  if (response.error) throw response.error;
  const parsed = todayResultSchema.safeParse(response.data);
  if (!parsed.success) throw new AppError({ code: 'RETRYABLE' });
  const result = parsed.data;
  if (!result.ok) throw new AppError(result.error);
  const { agenda, importantDates, dueTasks, notes } = result.data;
  if ([agenda, importantDates, dueTasks, notes].some(rows => rows.some(row => row.pairId !== pair))) {
    throw new AppError({ code: 'FORBIDDEN' });
  }
  const now = Date.now();
  return { agenda: agenda.filter(event => event.temporal.kind === 'allDay' || Date.parse(event.temporal.endsAt) > now),
    importantDates, dueTasks, notes };
}
