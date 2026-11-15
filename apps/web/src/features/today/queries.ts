import { z } from 'zod';
import { latestMemory } from '../memories';
import type { Memory } from '@deseo/domain/memories';
import { getSupabase } from '../../lib/supabase';
import type { QueryKeys } from '../../lib/query-keys';
import { dateSchema } from '@deseo/domain/calendar';
import { AppError } from '@deseo/domain/result';
import { todayResultSchema, type TodaySummary } from '@deseo/domain/today';

const all = (accountId: string, pairId: string) => ['today', accountId, pairId] as const;
export const todayKeys = {
  all,
  day: (accountId: string, pairId: string, date: string) => [...all(accountId, pairId), date] as const,
} satisfies QueryKeys;
export async function getToday(pairId: string, date: string): Promise<TodaySummary & { memory: Memory | null }> {
  const pair = z.string().uuid().parse(pairId);
  if (!dateSchema.safeParse(date).success) throw new AppError({ code: 'VALIDATION', field: 'date' });
  const client = getSupabase();
  const [response, memory] = await Promise.all([
    client.rpc('get_today', { p_pair_id: pair, p_date: date }), latestMemory(pair),
  ]);
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
    importantDates, dueTasks, notes, memory };
}
